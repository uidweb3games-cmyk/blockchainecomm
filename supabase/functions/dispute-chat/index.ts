// STAGE 2 of 4. This function is the ONLY way chat, evidence, and moderator
// data can be read or written - same locked-down pattern as shipping-info.
//
// It figures out who the real buyer and seller of an order are by looking
// at the shipping_addresses table (already populated for every real order),
// so a stranger can't claim to be part of someone else's order.
//
// Deploy with: supabase functions deploy dispute-chat

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { secp256k1 } from "https://esm.sh/@noble/curves@1.4.0/secp256k1";
import { keccak_256 } from "https://esm.sh/@noble/hashes@1.4.0/sha3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Same dependency-free signature verification as shipping-info ---
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return bytes;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function recoverEthAddress(message: string, signatureHex: string): string {
  const prefixed = `\x19Ethereum Signed Message:\n${message.length}${message}`;
  const msgHash = keccak_256(new TextEncoder().encode(prefixed));
  const sigBytes = hexToBytes(signatureHex);
  const rs = sigBytes.slice(0, 64);
  let v = sigBytes[64];
  if (v >= 27) v -= 27;
  const sig = secp256k1.Signature.fromCompact(rs).addRecoveryBit(v);
  const pubKey = sig.recoverPublicKey(msgHash).toRawBytes(false);
  const addrHash = keccak_256(pubKey.slice(1));
  return "0x" + bytesToHex(addrHash.slice(-20));
}
function shortHash(text: string): string {
  return bytesToHex(keccak_256(new TextEncoder().encode(text))).slice(0, 16);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Public keys are meant to be public - handled before the signature
    // check below, since looking them up doesn't require proving who you are.
    if (action === "getKeys") {
      const { addresses } = body;
      const { data, error } = await supabase
        .from("chat_public_keys")
        .select("wallet_address, public_key")
        .in("wallet_address", (addresses as string[]).map((a) => a.toLowerCase()));
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // Every other action requires a valid wallet signature.
    const { message, signature } = body;
    if (!message || !signature) return json({ error: "Missing signature" }, 400);
    const recovered = recoverEthAddress(message, signature);

    // Look up the real buyer/seller for an order from the shipping records,
    // and whether a wallet is an approved moderator. Used by several actions
    // below to decide who's allowed to see what.
    async function getOrderParties(contractAddress: string, orderId: number) {
      const { data } = await supabase
        .from("shipping_addresses")
        .select("buyer_address, seller_address")
        .eq("contract_address", contractAddress.toLowerCase())
        .eq("order_id", orderId)
        .maybeSingle();
      return data;
    }
    async function isModerator(address: string) {
      const { data } = await supabase
        .from("moderators")
        .select("wallet_address")
        .eq("wallet_address", address.toLowerCase())
        .maybeSingle();
      return !!data;
    }

    // ---------- Register a chat public key ----------
    if (action === "registerKey") {
      const { address, publicKey } = body;
      if (recovered.toLowerCase() !== String(address).toLowerCase()) {
        return json({ error: "Signature does not match address" }, 401);
      }
      const expected = `OpenSpace chat key register | address:${String(address).toLowerCase()}`;
      if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

      const { error } = await supabase
        .from("chat_public_keys")
        .upsert({ wallet_address: String(address).toLowerCase(), public_key: publicKey, updated_at: new Date().toISOString() });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---------- Chat messages ----------
    if (action === "sendMessage") {
      const { contractAddress, orderId, fromAddress, toAddress, ciphertext, nonce } = body;
      if (recovered.toLowerCase() !== String(fromAddress).toLowerCase()) {
        return json({ error: "Signature does not match sender" }, 401);
      }
      const expected = `OpenSpace chat send | contract:${String(contractAddress).toLowerCase()} | order:${orderId} | from:${String(fromAddress).toLowerCase()} | to:${String(toAddress).toLowerCase()} | msg:${shortHash(ciphertext)}`;
      if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

      const parties = await getOrderParties(contractAddress, orderId);
      if (!parties) return json({ error: "Order not found" }, 404);
      const pair = [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase());
      if (!pair.includes(fromAddress.toLowerCase()) || !pair.includes(toAddress.toLowerCase())) {
        return json({ error: "You are not a party to this order" }, 403);
      }

      const { error } = await supabase.from("chat_messages").insert({
        contract_address: String(contractAddress).toLowerCase(),
        order_id: orderId,
        from_address: String(fromAddress).toLowerCase(),
        to_address: String(toAddress).toLowerCase(),
        ciphertext,
        nonce,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "getMessages") {
      const { contractAddress, orderId, requesterAddress } = body;
      if (recovered.toLowerCase() !== String(requesterAddress).toLowerCase()) {
        return json({ error: "Signature does not match requester" }, 401);
      }
      // Session-wide (not tied to one order) so switching between chats
      // doesn't ask for a new signature every time - just once per visit.
      const expected = `OpenSpace chat read | contract:${String(contractAddress).toLowerCase()} | wallet:${String(requesterAddress).toLowerCase()}`;
      if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

      const parties = await getOrderParties(contractAddress, orderId);
      if (!parties) return json({ error: "Order not found" }, 404);
      const pair = [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase());
      if (!pair.includes(requesterAddress.toLowerCase())) {
        return json({ error: "You are not a party to this order" }, 403);
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, from_address, to_address, ciphertext, nonce, created_at")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // ---------- Dispute evidence ----------
    if (action === "submitEvidence") {
      const { contractAddress, orderId, submittedBy, imageUrl, note } = body;
      if (recovered.toLowerCase() !== String(submittedBy).toLowerCase()) {
        return json({ error: "Signature does not match submitter" }, 401);
      }
      const expected = `OpenSpace evidence submit | contract:${String(contractAddress).toLowerCase()} | order:${orderId} | by:${String(submittedBy).toLowerCase()}`;
      if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

      const parties = await getOrderParties(contractAddress, orderId);
      if (!parties) return json({ error: "Order not found" }, 404);
      const pair = [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase());
      if (!pair.includes(submittedBy.toLowerCase())) {
        return json({ error: "You are not a party to this order" }, 403);
      }

      const { error } = await supabase.from("dispute_evidence").insert({
        contract_address: String(contractAddress).toLowerCase(),
        order_id: orderId,
        submitted_by: String(submittedBy).toLowerCase(),
        image_url: imageUrl || null,
        note: note || null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "getEvidence") {
      const { contractAddress, orderId, requesterAddress } = body;
      if (recovered.toLowerCase() !== String(requesterAddress).toLowerCase()) {
        return json({ error: "Signature does not match requester" }, 401);
      }
      // Also session-wide, so a moderator reviewing several disputes only
      // signs once per visit instead of once per case.
      const expected = `OpenSpace evidence read | contract:${String(contractAddress).toLowerCase()} | wallet:${String(requesterAddress).toLowerCase()}`;
      if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

      const parties = await getOrderParties(contractAddress, orderId);
      const pair = parties ? [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase()) : [];
      const allowed = pair.includes(requesterAddress.toLowerCase()) || (await isModerator(requesterAddress));
      if (!allowed) return json({ error: "Not authorized to view this evidence" }, 403);

      const { data, error } = await supabase
        .from("dispute_evidence")
        .select("id, submitted_by, image_url, note, created_at")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // ---------- Moderator check (used by the frontend to show/hide the Dispute Queue) ----------
    if (action === "checkModerator") {
      const { address } = body;
      if (recovered.toLowerCase() !== String(address).toLowerCase()) {
        return json({ error: "Signature does not match address" }, 401);
      }
      const expected = `OpenSpace moderator check | address:${String(address).toLowerCase()}`;
      if (message !== expected) return json({ error: "Signed message does not match request" }, 401);
      return json({ isModerator: await isModerator(address) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("dispute-chat error:", e);
    return json({ error: String(e) }, 500);
  }
});
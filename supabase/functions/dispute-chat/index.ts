// STAGE 2 (revised). This function is the ONLY way chat, evidence, and
// moderator data can be read or written - same locked-down pattern as
// shipping-info.
//
// Everything in this function (except the public getKeys lookup) is
// authorized by ONE signed "session" message per wallet, reused for every
// action - registering your key, reading messages, sending messages,
// evidence, and moderator checks. This is standard practice (like logging
// in once instead of re-entering your password for every click) and is
// safe here because messages are already encrypted, so there's nothing
// meaningful to gain by replaying this signature beyond what it already
// authorizes within this one marketplace.
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Public keys are meant to be public - no signature needed to look them up.
    if (action === "getKeys") {
      const { addresses } = body;
      const { data, error } = await supabase
        .from("chat_public_keys")
        .select("wallet_address, public_key")
        .in("wallet_address", (addresses as string[]).map((a) => a.toLowerCase()));
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // Also public, on purpose: this only reveals THAT a conversation exists
    // on an order and roughly WHEN it was last active - never the message
    // content itself. That's safe without a signature, and it's what lets a
    // notification badge work even for someone who hasn't set up chat yet -
    // they can see something's waiting before they ever sign anything.
    if (action === "getActivity") {
      const { contractAddress, walletAddress } = body;
      const wallet = String(walletAddress).toLowerCase();
      const { data, error } = await supabase
        .from("chat_messages")
        .select("order_id, created_at")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .or(`from_address.eq.${wallet},to_address.eq.${wallet}`)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      const latest: Record<string, string> = {};
      for (const row of data || []) {
        if (!latest[row.order_id]) latest[row.order_id] = row.created_at;
      }
      return json({ data: latest });
    }

    // Every other action is authorized by the same one session signature.
    const { message, signature, contractAddress, walletAddress } = body;
    if (!message || !signature || !walletAddress || !contractAddress) {
      return json({ error: "Missing signature" }, 400);
    }
    const recovered = recoverEthAddress(message, signature);
    if (recovered.toLowerCase() !== String(walletAddress).toLowerCase()) {
      return json({ error: "Signature does not match wallet" }, 401);
    }
    const expected = `OpenSpace chat session | contract:${String(contractAddress).toLowerCase()} | wallet:${String(walletAddress).toLowerCase()}`;
    if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

    async function getOrderParties(orderId: number) {
      const { data } = await supabase
        .from("shipping_addresses")
        .select("buyer_address, seller_address")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .eq("order_id", orderId)
        .maybeSingle();
      return data;
    }
    async function isModerator(addr: string) {
      // Case-insensitive on purpose - addresses typed into the table
      // manually might not always be lowercase, and this shouldn't matter.
      const { data } = await supabase
        .from("moderators")
        .select("wallet_address")
        .ilike("wallet_address", addr)
        .maybeSingle();
      return !!data;
    }

    if (action === "registerKey") {
      const { publicKey } = body;
      const { error } = await supabase
        .from("chat_public_keys")
        .upsert({ wallet_address: walletAddress.toLowerCase(), public_key: publicKey, updated_at: new Date().toISOString() });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "sendMessage") {
      const { orderId, toAddress, ciphertext, nonce } = body;
      const parties = await getOrderParties(orderId);
      if (!parties) return json({ error: "Order not found" }, 404);
      const pair = [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase());
      if (!pair.includes(walletAddress.toLowerCase()) || !pair.includes(String(toAddress).toLowerCase())) {
        return json({ error: "You are not a party to this order" }, 403);
      }
      const { error } = await supabase.from("chat_messages").insert({
        contract_address: String(contractAddress).toLowerCase(),
        order_id: orderId,
        from_address: walletAddress.toLowerCase(),
        to_address: String(toAddress).toLowerCase(),
        ciphertext,
        nonce,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "getMessages") {
      const { orderId } = body;
      const parties = await getOrderParties(orderId);
      if (!parties) return json({ error: "Order not found" }, 404);
      const pair = [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase());
      if (!pair.includes(walletAddress.toLowerCase())) {
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

    if (action === "submitEvidence") {
      const { orderId, imageUrl, note } = body;
      const parties = await getOrderParties(orderId);
      if (!parties) return json({ error: "Order not found" }, 404);
      const pair = [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase());
      if (!pair.includes(walletAddress.toLowerCase())) {
        return json({ error: "You are not a party to this order" }, 403);
      }
      const { error } = await supabase.from("dispute_evidence").insert({
        contract_address: String(contractAddress).toLowerCase(),
        order_id: orderId,
        submitted_by: walletAddress.toLowerCase(),
        image_url: imageUrl || null,
        note: note || null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "getEvidence") {
      const { orderId } = body;
      const parties = await getOrderParties(orderId);
      const pair = parties ? [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase()) : [];
      const allowed = pair.includes(walletAddress.toLowerCase()) || (await isModerator(walletAddress));
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

    if (action === "checkModerator") {
      return json({ isModerator: await isModerator(walletAddress) });
    }

    // ---------- Dispute case status: claimed-by + moderator notes ----------
    if (action === "claimCase") {
      if (!(await isModerator(walletAddress))) return json({ error: "Not authorized" }, 403);
      const { orderId } = body;
      const { data: existing } = await supabase
        .from("dispute_case_status")
        .select("claimed_by")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .eq("order_id", orderId)
        .maybeSingle();
      // Toggle: claim if unclaimed, unclaim if you're the one who claimed it.
      const newClaimedBy = !existing || !existing.claimed_by ? walletAddress.toLowerCase()
        : existing.claimed_by === walletAddress.toLowerCase() ? null
        : existing.claimed_by; // someone else already has it - leave as-is
      const { error } = await supabase.from("dispute_case_status").upsert({
        contract_address: String(contractAddress).toLowerCase(),
        order_id: orderId,
        claimed_by: newClaimedBy,
        updated_at: new Date().toISOString(),
      }, { onConflict: "contract_address,order_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, claimedBy: newClaimedBy });
    }

    if (action === "setNote") {
      if (!(await isModerator(walletAddress))) return json({ error: "Not authorized" }, 403);
      const { orderId, note } = body;
      const { error } = await supabase.from("dispute_case_status").upsert({
        contract_address: String(contractAddress).toLowerCase(),
        order_id: orderId,
        moderator_note: note,
        updated_at: new Date().toISOString(),
      }, { onConflict: "contract_address,order_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "getCaseStatus") {
      const { orderIds } = body;
      const modApproved = await isModerator(walletAddress);
      const allowedOrderIds: number[] = [];
      for (const oid of orderIds as number[]) {
        if (modApproved) { allowedOrderIds.push(oid); continue; }
        const parties = await getOrderParties(oid);
        if (parties) {
          const pair = [parties.buyer_address, parties.seller_address].map((a) => a.toLowerCase());
          if (pair.includes(walletAddress.toLowerCase())) allowedOrderIds.push(oid);
        }
      }
      if (allowedOrderIds.length === 0) return json({ data: [] });
      const { data, error } = await supabase
        .from("dispute_case_status")
        .select("order_id, claimed_by, moderator_note")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .in("order_id", allowedOrderIds);
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("dispute-chat error:", e);
    return json({ error: String(e) }, 500);
  }
});
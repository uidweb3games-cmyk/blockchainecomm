// Handles seller shop profiles (shop name + bio) - the "storefront" info.
// Reading a profile is public/unauthenticated on purpose, since a
// storefront needs to be viewable by anyone, not just the seller. Saving
// your own profile requires the same one-time session signature already
// used elsewhere in the app.
//
// Deploy with: supabase functions deploy seller-profiles

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
    const { action, contractAddress } = body;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Public - anyone can view a seller's storefront info, no signature needed.
    if (action === "getProfile") {
      const { walletAddress } = body;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("shop_name, bio")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .eq("wallet_address", String(walletAddress).toLowerCase())
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // Public - checks many sellers at once for the "Verified Seller" badge
    // (has this seller completed shop setup?). Only returns which addresses
    // have a profile, not the profile content itself.
    if (action === "getVerifiedSellers") {
      const { walletAddresses } = body;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("wallet_address")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .in("wallet_address", (walletAddresses as string[]).map((a) => a.toLowerCase()));
      if (error) return json({ error: error.message }, 500);
      return json({ data: (data || []).map((r: any) => r.wallet_address) });
    }

    // Saving your own profile requires proving you own the wallet.
    const { message, signature, walletAddress } = body;
    if (!message || !signature || !walletAddress) return json({ error: "Missing signature" }, 400);
    const recovered = recoverEthAddress(message, signature);
    if (recovered.toLowerCase() !== String(walletAddress).toLowerCase()) {
      return json({ error: "Signature does not match wallet" }, 401);
    }
    const expected = `OpenSpace chat session | contract:${String(contractAddress).toLowerCase()} | wallet:${String(walletAddress).toLowerCase()}`;
    if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

    if (action === "saveProfile") {
      const { shopName, bio } = body;
      if (!shopName || !String(shopName).trim()) return json({ error: "Shop name is required" }, 400);
      const { error } = await supabase.from("seller_profiles").upsert({
        wallet_address: walletAddress.toLowerCase(),
        contract_address: String(contractAddress).toLowerCase(),
        shop_name: String(shopName).trim(),
        bio: bio ? String(bio).trim() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "wallet_address" });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("seller-profiles error:", e);
    return json({ error: String(e) }, 500);
  }
});
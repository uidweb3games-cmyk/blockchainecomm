// Handles site visit tracking, wallet connection tracking, and returning
// daily counts for the admin analytics chart. Logging a visit or a
// connection is public/unauthenticated on purpose - it's just anonymous
// counting, nothing sensitive or fund-related. Reading the aggregated
// numbers back requires being a moderator/admin, same as the Dispute Queue.
//
// Deploy with: supabase functions deploy site-analytics

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

// Groups a list of ISO timestamps into counts per calendar day (UTC),
// filling in any missing days with 0 so the chart doesn't have gaps.
function groupByDay(timestamps: string[], days: number): { date: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const t of timestamps) {
    const day = t.slice(0, 10);
    counts[day] = (counts[day] || 0) + 1;
  }
  const result: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: counts[key] || 0 });
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, contractAddress } = body;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Public - anonymous visit counting, nothing sensitive.
    if (action === "logVisit") {
      const { error } = await supabase.from("site_visits").insert({
        contract_address: String(contractAddress).toLowerCase(),
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // Public - just records that this address connected at least once.
    // Using the wallet address as the primary key means a repeat connection
    // from the same wallet is automatically ignored, not double-counted.
    if (action === "logWalletConnection") {
      const { walletAddress } = body;
      const { error } = await supabase.from("wallet_connections").upsert({
        wallet_address: String(walletAddress).toLowerCase(),
        contract_address: String(contractAddress).toLowerCase(),
      }, { onConflict: "wallet_address", ignoreDuplicates: true });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // Everything else (reading the aggregated numbers) requires being a
    // moderator/admin, verified the same way as the Dispute Queue.
    const { message, signature, walletAddress } = body;
    if (!message || !signature || !walletAddress) return json({ error: "Missing signature" }, 400);
    const recovered = recoverEthAddress(message, signature);
    if (recovered.toLowerCase() !== String(walletAddress).toLowerCase()) {
      return json({ error: "Signature does not match wallet" }, 401);
    }
    const expected = `OpenSpace chat session | contract:${String(contractAddress).toLowerCase()} | wallet:${String(walletAddress).toLowerCase()}`;
    if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

    const { data: modRow } = await supabase
      .from("moderators")
      .select("wallet_address")
      .ilike("wallet_address", walletAddress)
      .maybeSingle();
    if (!modRow) return json({ error: "Not authorized" }, 403);

    if (action === "getAnalytics") {
      const days = body.days || 30;
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - days);

      const { data: visits, error: visitsError } = await supabase
        .from("site_visits")
        .select("visited_at")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .gte("visited_at", since.toISOString());
      if (visitsError) return json({ error: visitsError.message }, 500);

      const { data: connections, error: connError } = await supabase
        .from("wallet_connections")
        .select("connected_at")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .gte("connected_at", since.toISOString());
      if (connError) return json({ error: connError.message }, 500);

      const { count: totalVisits } = await supabase
        .from("site_visits")
        .select("id", { count: "exact", head: true })
        .eq("contract_address", String(contractAddress).toLowerCase());
      const { count: totalAccounts } = await supabase
        .from("wallet_connections")
        .select("wallet_address", { count: "exact", head: true })
        .eq("contract_address", String(contractAddress).toLowerCase());

      return json({
        visitsByDay: groupByDay((visits || []).map((v: any) => v.visited_at), days),
        accountsByDay: groupByDay((connections || []).map((c: any) => c.connected_at), days),
        totalVisits: totalVisits || 0,
        totalAccounts: totalAccounts || 0,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("site-analytics error:", e);
    return json({ error: String(e) }, 500);
  }
});
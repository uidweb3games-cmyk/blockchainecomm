// This function is the ONLY way shipping data can be read or written.
// It runs on Supabase's servers (not in the browser), so the checks below
// can't be bypassed by anyone editing frontend code or calling the database
// directly with the public key.
//
// Deploy with: supabase functions deploy shipping-info
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// Supabase to every Edge Function - nothing to configure manually.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/ethers@6.13.4";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, message, signature } = body;

    if (!message || !signature) return json({ error: "Missing signature" }, 400);

    // Recover the wallet address that actually produced this signature.
    // This is pure cryptography - no blockchain call needed - so it's free
    // and instant, and it can't be faked without the real private key.
    const recovered = verifyMessage(message, signature);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (action === "save") {
      const { contractAddress, buyerAddress, orderIds, sellerAddresses, info } = body;

      if (recovered.toLowerCase() !== String(buyerAddress).toLowerCase()) {
        return json({ error: "Signature does not match the buyer address" }, 401);
      }
      // The signed message itself must reference these exact order IDs and this
      // exact buyer - so a captured signature can't be replayed for other orders.
      const expected = `OpenSpace shipping save | contract:${String(contractAddress).toLowerCase()} | orders:${(orderIds as number[]).join(",")} | buyer:${String(buyerAddress).toLowerCase()}`;
      if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

      const rows = (orderIds as number[]).map((id) => ({
        contract_address: String(contractAddress).toLowerCase(),
        order_id: id,
        buyer_address: String(buyerAddress).toLowerCase(),
        seller_address: sellerAddresses && sellerAddresses[id] ? String(sellerAddresses[id]).toLowerCase() : null,
        full_name: info.fullName,
        street_address: info.address,
        city: info.city,
        country: info.country,
        phone: info.phone,
      }));

      const { error } = await supabase
        .from("shipping_addresses")
        .upsert(rows, { onConflict: "contract_address,order_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "get") {
      const { contractAddress, sellerAddress, orderIds } = body;

      if (recovered.toLowerCase() !== String(sellerAddress).toLowerCase()) {
        return json({ error: "Signature does not match the seller address" }, 401);
      }
      const expected = `OpenSpace shipping unlock | contract:${String(contractAddress).toLowerCase()} | seller:${String(sellerAddress).toLowerCase()}`;
      if (message !== expected) return json({ error: "Signed message does not match request" }, 401);

      // Scoped to this seller's own address even if extra order IDs were
      // requested - so a seller can never pull another seller's buyer data.
      const { data, error } = await supabase
        .from("shipping_addresses")
        .select("order_id, full_name, street_address, city, country, phone")
        .eq("contract_address", String(contractAddress).toLowerCase())
        .eq("seller_address", String(sellerAddress).toLowerCase())
        .in("order_id", orderIds);
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("shipping-info error:", e);
    return json({ error: String(e) }, 500);
  }
});

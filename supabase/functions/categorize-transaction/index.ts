import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = ["Food", "Transport", "Housing", "Entertainment", "Health", "Shopping", "Utilities", "Other"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description } = await req.json();
    if (!description || typeof description !== "string") {
      return new Response(JSON.stringify({ error: "description is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Categorize the following transaction description into exactly one of these categories: ${CATEGORIES.join(", ")}. Respond with ONLY the category name, nothing else.`,
          },
          { role: "user", content: description },
        ],
      }),
    });

    if (!response.ok) {
      // Fallback to rule-based categorization
      const category = ruleBasedCategory(description);
      return new Response(JSON.stringify({ category }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let category = data.choices?.[0]?.message?.content?.trim() || "Other";
    if (!CATEGORIES.includes(category)) category = "Other";

    return new Response(JSON.stringify({ category }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("categorize error:", e);
    return new Response(
      JSON.stringify({ category: "Other" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function ruleBasedCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (/restaurant|food|grocery|supermarket|cafe|coffee|lunch|dinner|pizza|burger/.test(d)) return "Food";
  if (/uber|taxi|bus|train|gas|fuel|parking|metro|flight/.test(d)) return "Transport";
  if (/rent|mortgage|apartment|house|property/.test(d)) return "Housing";
  if (/netflix|spotify|cinema|movie|game|concert|subscription/.test(d)) return "Entertainment";
  if (/doctor|pharmacy|hospital|medical|health|gym|fitness/.test(d)) return "Health";
  if (/amazon|shop|store|clothing|electronics|ikea/.test(d)) return "Shopping";
  if (/electric|water|internet|phone|utility|insurance/.test(d)) return "Utilities";
  return "Other";
}

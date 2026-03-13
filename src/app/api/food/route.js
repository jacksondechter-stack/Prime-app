import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query) return Response.json({ error: "No query" }, { status: 400 });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `You are a nutrition database. Given a food description, return nutritional data as JSON.
Return ONLY a JSON object with an "items" array. Each item must have:
- name (string): food name
- cal (number): total calories
- p (number): protein in grams
- c (number): total carbs in grams
- f (number): total fat in grams
- sugar (number): total sugar in grams
- fiber (number): dietary fiber in grams
- sodium (number): sodium in milligrams
- satFat (number): saturated fat in grams
- addedSugar (number): added sugar in grams (not naturally occurring)
- serving (string): serving size description
- junk (boolean): true ONLY if food is ultra-processed with poor nutrient density
- junkReason (string): brief reason if junk is true

Use USDA FoodData Central values when possible. Be accurate with micronutrients.

For the "junk" field, use this evidence-based criteria (NRF-inspired):
- junk=true if: added sugar > 25% of calories, OR protein < 2g per 100cal AND calories > 150, OR food is ultra-processed (candy, soda, chips, fast food fried items, pastries)
- junk=false if: food has meaningful protein (>2g/100cal), is minimally processed, or is a whole food regardless of calories

Examples:
- Grilled chicken 500cal: junk=false (high protein whole food)
- PopCorners 140cal: junk=false (baked snack, moderate macros)
- Doritos 280cal: junk=true (ultra-processed, low protein density)
- Soda 140cal: junk=true (100% added sugar, zero nutrients)
- Salmon 400cal: junk=false (nutrient-dense whole food)
- Peanut butter 190cal: junk=false (whole food, good fats + protein)

Return ONLY valid JSON, no markdown, no explanation.`,
      messages: [{ role: "user", content: query }],
    });

    const text = msg.content[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);
    return Response.json(data);
  } catch (e) {
    console.error("Food API error:", e);
    return Response.json({ error: "Food lookup failed", details: e.message }, { status: 500 });
  }
}

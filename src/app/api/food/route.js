import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query) return Response.json({ error: "No query" }, { status: 400 });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `You are a precise nutrition database. Given a food description, return accurate nutritional data as JSON.

CRITICAL ACCURACY RULES:
1. For named restaurant chains (Chipotle, McDonald's, Subway, Chick-fil-A, Starbucks, etc.), use their PUBLISHED nutrition data. A Chipotle chicken burrito with rice, beans, salsa, cheese, sour cream is ~1050 calories. Do NOT underestimate restaurant food.
2. Restaurant portions are LARGE. A burrito bowl, large sandwich, or combo meal is typically 800-1200 calories.
3. When a user says "with a bunch of stuff" or lists multiple toppings, add each ingredient's calories. Full toppings at Chipotle add 300-400 calories on top of base.
4. For homemade meals, use standard portion sizes (not minimal diet portions).
5. If the query describes multiple items, return each as a separate item in the array.
6. NEVER underestimate — it is better to be slightly over than under. Underestimating causes users to eat more than they think.

Return ONLY a JSON object with an "items" array. Each item must have:
- name (string): food name with key ingredients
- cal (number): total calories — use ACTUAL restaurant values, not conservative estimates
- p (number): protein in grams
- c (number): total carbs in grams
- f (number): total fat in grams
- sugar (number): total sugar in grams
- fiber (number): dietary fiber in grams
- sodium (number): sodium in milligrams
- satFat (number): saturated fat in grams
- addedSugar (number): added sugar in grams
- serving (string): serving size description (e.g. "1 burrito ~330g")
- junk (boolean): true ONLY if ultra-processed with poor nutrient density
- junkReason (string): brief reason if junk is true

Junk criteria: junk=true if added sugar >25% of calories, OR ultra-processed (candy, soda, chips, fried fast food, pastries). High-calorie whole foods are NOT junk.

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

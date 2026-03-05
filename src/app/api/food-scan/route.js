import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req) {
  try {
    const { image } = await req.json();
    if (!image) return Response.json({ error: "No image" }, { status: 400 });

    const mediaType = image.startsWith("/9j/") ? "image/jpeg" : "image/png";
    
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a nutrition expert with access to USDA FoodData Central knowledge. Analyze the food in this image and return nutritional data as JSON.

Return ONLY a JSON object with an "items" array. Each item must have:
- name (string): specific food name (brand if identifiable)
- cal (number): total calories
- p (number): protein in grams
- c (number): total carbs in grams  
- f (number): total fat in grams
- sugar (number): total sugar in grams
- fiber (number): dietary fiber in grams
- sodium (number): sodium in milligrams
- satFat (number): saturated fat in grams
- addedSugar (number): added sugar in grams
- serving (string): estimated serving size
- junk (boolean): see criteria below
- junkReason (string): brief reason if junk is true

For the "junk" field, use NRF-inspired evidence-based criteria:
- junk=true if: added sugar > 25% of calories, OR protein < 2g per 100cal AND calories > 150, OR food is ultra-processed (candy, soda, chips, fast food fried items, pastries)  
- junk=false if: food has meaningful protein (>2g/100cal), is minimally processed, or is a whole food regardless of calorie count

Be accurate. Use USDA values for common foods. For mixed dishes, estimate component-level nutrients.
Return ONLY valid JSON, no markdown.`,
      messages: [{
        role: "user",
        content: [{
          type: "image",
          source: { type: "base64", media_type: mediaType, data: image }
        }, {
          type: "text",
          text: "Identify all food items in this image and provide detailed nutritional data for each."
        }]
      }],
    });

    const text = msg.content[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);
    return Response.json(data);
  } catch (e) {
    console.error("Food scan error:", e);
    return Response.json({ error: "Food scan failed", details: e.message }, { status: 500 });
  }
}

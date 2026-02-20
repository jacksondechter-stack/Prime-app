import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: "No query" }, { status: 400 });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: `You are a precise nutrition database. When given a food or meal description, return accurate nutritional data. For restaurant items, use the actual published nutrition facts. For generic foods, use USDA data. For compound meals, break them into individual items. Flag items as "junk" if they are high in processed ingredients, added sugar, or unhealthy fats. Even "healthy" foods can have junk components - for example, a protein shake might have good protein but also added sugar, so flag the sugar portion. Always respond with ONLY valid JSON, no other text.`,
        messages: [{
          role: "user",
          content: `Return nutrition data for: "${query}"
          
Respond with ONLY this JSON format:
{
  "items": [
    {
      "name": "item name",
      "cal": calories,
      "p": protein_grams,
      "c": carb_grams,
      "f": fat_grams,
      "fiber": fiber_grams,
      "sugar": sugar_grams,
      "junk": true/false,
      "junkReason": "reason if junk (e.g. 'high sugar', 'fried', 'processed') or null",
      "serving": "serving size description"
    }
  ]
}`
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `API ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    let text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    
    let jsonStr = text;
    const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();
    else { const brace = text.match(/\{[\s\S]*\}/); if (brace) jsonStr = brace[0]; }

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

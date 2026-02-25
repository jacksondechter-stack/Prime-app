import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req) {
  try {
    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: image,
                },
              },
              {
                type: "text",
                text: `Identify every food item visible in this photo. For each item, estimate the portion size and provide accurate nutritional info.

Return ONLY a JSON array like this, no other text:
[{"name":"Grilled Chicken Breast","cal":165,"p":31,"c":0,"f":3.6,"sugar":0,"serving":"~6oz","junk":false},{"name":"French Fries","cal":365,"p":4,"c":44,"f":17,"sugar":0,"serving":"medium","junk":true,"junkReason":"deep fried"}]

Rules:
- Be specific with food names (not just "meat" - say "grilled chicken thigh")
- Estimate realistic portion sizes based on what you see
- junk=true for fried foods, sugary drinks, candy, chips, fast food, etc
- Include a junkReason if junk=true
- If you can identify the restaurant or brand, use their actual nutrition data
- Return valid JSON array only, no markdown, no explanation`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      return NextResponse.json({ error: "AI scan failed" }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";

    let items;
    try {
      const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      items = JSON.parse(clean);
    } catch (e) {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          items = JSON.parse(match[0]);
        } catch (e2) {
          return NextResponse.json({ error: "Could not parse food items" }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "No food items found" }, { status: 500 });
      }
    }

    items = items.map((item) => ({
      name: item.name || "Unknown food",
      cal: Math.round(item.cal || item.calories || 0),
      p: Math.round(item.p || item.protein || 0),
      c: Math.round(item.c || item.carbs || 0),
      f: Math.round(item.f || item.fat || 0),
      sugar: Math.round(item.sugar || 0),
      serving: item.serving || "",
      junk: item.junk || false,
      junkReason: item.junkReason || "",
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Food scan error:", error);
    return NextResponse.json({ error: "Scan failed: " + error.message }, { status: 500 });
  }
}

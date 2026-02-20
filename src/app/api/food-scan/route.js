import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { image } = await req.json();
    if (!image) return NextResponse.json({ error: "No image" }, { status: 400 });

    let base64Data = image;
    let mediaType = "image/jpeg";
    if (image.startsWith("data:")) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) { mediaType = match[1]; base64Data = match[2]; }
      else { base64Data = image.split(",")[1] || image; }
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
        max_tokens: 800,
        system: "You are a precise food nutrition analyzer. When shown a photo of food, identify every item on the plate/in the meal and estimate accurate nutritional data for each item. Use standard serving sizes. Flag junk items. Respond with ONLY valid JSON.",
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            { type: "text", text: `Identify all food items in this photo and return nutrition data.

Return ONLY this JSON:
{
  "items": [
    {
      "name": "item name with estimated portion",
      "cal": calories,
      "p": protein_grams,
      "c": carb_grams,
      "f": fat_grams,
      "sugar": sugar_grams,
      "junk": true/false,
      "junkReason": "reason if junk or null",
      "serving": "estimated serving size"
    }
  ]
}` }
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `API ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    let text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonStr = codeMatch ? codeMatch[1].trim() : text;
    const brace = jsonStr.match(/\{[\s\S]*\}/);
    if (brace) jsonStr = brace[0];

    return NextResponse.json(JSON.parse(jsonStr));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const image = body.image;
    const type = body.type || body.context || "current";
    
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Extract base64 data and media type
    let base64Data = image;
    let mediaType = "image/jpeg";
    
    if (image.startsWith("data:")) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        mediaType = match[1];
        base64Data = match[2];
      } else {
        base64Data = image.split(",")[1] || image;
      }
    }

    const prompt = type === "goal"
      ? `You are a fitness AI. Analyze this goal physique photo. Estimate the body fat percentage of the person in this photo. Respond with ONLY a JSON object, no other text: {"bf": <number>, "lean": "yes or no", "notes": "<brief 1-sentence assessment>"}`
      : `You are a fitness AI. Analyze this photo for body composition. Estimate the body fat percentage. Respond with ONLY a JSON object, no other text: {"bf": <number>, "muscle": "low/moderate/high", "notes": "<brief 1-sentence assessment>"}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `API error ${response.status}: ${errText.slice(0, 200)}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    // Extract text from the response - handle multiple content block formats
    let text = "";
    if (data.content && Array.isArray(data.content)) {
      text = data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    } else if (typeof data.content === "string") {
      text = data.content;
    }

    if (!text) {
      console.error("No text in response:", JSON.stringify(data));
      return NextResponse.json(
        { error: "No text in API response" },
        { status: 500 }
      );
    }

    // Try to extract JSON from the response text
    // Claude sometimes wraps JSON in markdown code blocks
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to find raw JSON object
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        jsonStr = braceMatch[0];
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON parse failed. Raw text:", text);
      // Try to extract just the bf number as fallback
      const bfMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
      if (bfMatch) {
        parsed = { bf: parseFloat(bfMatch[1]), notes: text.slice(0, 100) };
      } else {
        return NextResponse.json(
          { error: "Could not parse response: " + text.slice(0, 150) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}

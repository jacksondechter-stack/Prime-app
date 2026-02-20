import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, query, profile } = body;

    if (action === "lookup") {
      // Look up any exercise - return MET value, muscle groups, proper form cues
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          system: "You are a comprehensive exercise database and fitness calculator. You know every exercise imaginable - weight training, bodyweight, cardio, yoga, sports, etc. Return precise MET values, muscle groups, and calorie calculations. Respond with ONLY valid JSON.",
          messages: [{
            role: "user",
            content: `Exercise lookup: "${query}"
User weight: ${profile?.weight || 150} lbs

Return JSON:
{
  "name": "proper exercise name",
  "type": "strength/cardio/flexibility/sport",
  "muscles": ["primary muscle", "secondary muscles"],
  "met": MET_value_number,
  "calPerMin": calories_per_minute_for_this_user,
  "defaultSets": number_or_null,
  "defaultReps": "rep_range_or_null",
  "tips": "one brief form tip"
}`
          }],
        }),
      });

      if (!response.ok) return NextResponse.json({ error: `API ${response.status}` }, { status: 500 });
      const data = await response.json();
      let text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      const brace = text.match(/\{[\s\S]*\}/);
      return NextResponse.json(JSON.parse(brace ? brace[0] : text));

    } else if (action === "generate") {
      // Generate a full workout for today
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are an expert personal trainer. Generate effective, well-structured workouts tailored to the user's goals, equipment, and fitness level. Include proper warm-up considerations. Respond with ONLY valid JSON.",
          messages: [{
            role: "user",
            content: `Generate a workout for today.

User profile:
- Weight: ${profile?.weight || 150} lbs
- Goal: ${profile?.goal || "lose fat, build muscle"}
- Focus: ${profile?.focus || "full body"}
- Equipment: ${profile?.equipment || "full gym"}
- Experience: ${profile?.experience || "intermediate"}
- Time: ${profile?.time || "45-60 min"}
${profile?.recentWorkouts ? `- Recent workouts: ${profile.recentWorkouts}` : ""}
${profile?.avoid ? `- Avoid: ${profile.avoid}` : ""}

Return JSON:
{
  "title": "workout name",
  "focus": "muscle groups targeted",
  "duration": estimated_minutes,
  "exercises": [
    {
      "name": "exercise name",
      "type": "strength/cardio/core",
      "muscles": ["muscle groups"],
      "sets": number,
      "reps": "rep range or duration",
      "met": MET_value,
      "rest": "rest period",
      "notes": "brief tip or null"
    }
  ],
  "finisher": {
    "name": "optional finisher exercise",
    "description": "brief description"
  }
}`
          }],
        }),
      });

      if (!response.ok) return NextResponse.json({ error: `API ${response.status}` }, { status: 500 });
      const data = await response.json();
      let text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      const brace = text.match(/\{[\s\S]*\}/);
      return NextResponse.json(JSON.parse(brace ? brace[0] : text));
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

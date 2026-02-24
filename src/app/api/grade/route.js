import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { profile, day } = await req.json();

    const prompt = `You are a fitness coach grading someone's day. Be honest, specific, and motivating.

USER PROFILE:
- Height: ${profile.height || "unknown"} inches
- Current weight: ${profile.weight || "unknown"} lbs
- Goal weight: ${profile.goalWeight || "unknown"} lbs
- Body fat: ${profile.bodyFat || "unknown"}%
- Sex: ${profile.sex || "unknown"}
- Age: ${profile.age || "unknown"}
- Activity level: ${profile.activity || "unknown"}

TODAY'S DATA:
- Breakfast: ${JSON.stringify(day.meals.breakfast.map(m => m.name + " (" + m.cal + " cal, " + m.p + "g protein)"))}
- Lunch: ${JSON.stringify(day.meals.lunch.map(m => m.name + " (" + m.cal + " cal, " + m.p + "g protein)"))}
- Snack: ${JSON.stringify(day.meals.snack.map(m => m.name + " (" + m.cal + " cal, " + m.p + "g protein)"))}
- Dinner: ${JSON.stringify(day.meals.dinner.map(m => m.name + " (" + m.cal + " cal, " + m.p + "g protein)"))}
- Workout: ${day.workout.submitted ? "Completed" : day.workout.exercises.length > 0 ? day.workout.exercises.map(e => e.name).join(", ") : day.workout.presetDone > 0 ? day.workout.presetDone + " exercises done" : "None"}
- Drinks: ${day.drinks.length > 0 ? JSON.stringify(day.drinks.map(d => d.name)) : "None"}
- Calories: ${day.calories.food} food / ${day.calories.workout} burned / ${day.calories.drinks} drinks / ${day.calories.net} net (target: ${day.calories.target})
- Protein: ${day.protein.actual}g of ${day.protein.target}g target
- Morning weight: ${day.weights.morning || "not logged"}
- Evening weight: ${day.weights.evening || "not logged"}

Grade this day A through F based on how well they executed toward their goals. Consider:
- Did they hit their calorie target?
- Did they hit their protein target (1g per lb of goal weight)?
- Did they work out?
- Food quality (junk vs whole foods)?
- Alcohol consumption?
- If very little or nothing was logged, grade it "I" for incomplete.

Respond ONLY with JSON, no markdown, no backticks:
{
  "grade": "A/B/C/D/F/I",
  "summary": "One short sentence summary of the day",
  "wins": ["specific win 1", "specific win 2"],
  "improve": ["specific area 1", "specific area 2"],
  "tip": "One actionable tip for tomorrow based on today's performance"
}`;

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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ grade: "C", summary: "Could not grade.", wins: [], improve: [], tip: "" }, { status: 500 });
    }

    const data = await response.json();
    let text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";

    let jsonStr = text;
    const codeMatch = text.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/);
    if (codeMatch) jsonStr = codeMatch[1].trim();
    else { const brace = text.match(/\{[\s\S]*\}/); if (brace) jsonStr = brace[0]; }

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({
      grade: "C",
      summary: "Could not generate grade.",
      wins: [],
      improve: [],
      tip: "Log all your meals tomorrow for a better assessment."
    });
  }
}

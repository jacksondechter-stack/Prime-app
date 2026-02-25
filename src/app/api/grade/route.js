import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { profile, day } = await req.json();

    const goalDir = profile.goalWeight && profile.weight ? (profile.goalWeight > profile.weight ? "GAIN weight" : profile.goalWeight < profile.weight ? "LOSE weight" : "MAINTAIN weight") : "unknown";
    const weightDiff = profile.goalWeight && profile.weight ? Math.abs(profile.goalWeight - profile.weight) : 0;
    const bfGoal = profile.goalBF ? "reduce body fat to " + profile.goalBF + "%" : "reduce body fat";

    const prompt = `You are a precision fitness analyst. Your job is to grade this person's day ENTIRELY based on THEIR specific goals and body composition targets. Not generic advice — everything must reference their exact numbers.

THIS PERSON'S GOAL: ${goalDir} from ${profile.weight || "?"} lbs to ${profile.goalWeight || "?"} lbs (${weightDiff} lbs to go) while trying to ${bfGoal}. Current body fat: ${profile.bodyFat || "unknown"}%.

USER PROFILE:
- Height: ${profile.height || "?"} inches, Weight: ${profile.weight || "?"} lbs, Age: ${profile.age || "?"}, Sex: ${profile.sex || "?"}
- Activity: ${profile.activity || "?"}
- Calorie target: ${day.calories.target} cal/day, Protein target: ${day.protein.target}g/day

TODAY'S INTAKE:
- Breakfast: ${day.meals.breakfast.length > 0 ? day.meals.breakfast.map(m => m.name + " (" + m.cal + " cal, " + m.p + "g P)").join(", ") : "Nothing logged"}
- Lunch: ${day.meals.lunch.length > 0 ? day.meals.lunch.map(m => m.name + " (" + m.cal + " cal, " + m.p + "g P)").join(", ") : "Nothing logged"}
- Snack: ${day.meals.snack.length > 0 ? day.meals.snack.map(m => m.name + " (" + m.cal + " cal, " + m.p + "g P)").join(", ") : "Nothing logged"}
- Dinner: ${day.meals.dinner.length > 0 ? day.meals.dinner.map(m => m.name + " (" + m.cal + " cal, " + m.p + "g P)").join(", ") : "Nothing logged"}
- Total food: ${day.calories.food} cal, ${day.protein.actual}g protein
- Workout: ${day.workout.submitted ? "Completed" : day.workout.exercises.length > 0 ? day.workout.exercises.map(e => e.name).join(", ") : day.workout.presetDone > 0 ? day.workout.presetDone + " exercises done" : "No workout"}
- Workout calories burned: ${day.calories.workout}
- Alcohol: ${day.drinks.length > 0 ? day.drinks.map(d => d.name).join(", ") + " (" + day.calories.drinks + " cal)" : "None"}
- Net calories: ${day.calories.net}
- Morning weight: ${day.weights.morning || "not logged"}, Evening weight: ${day.weights.evening || "not logged"}

CRITICAL GRADING LOGIC:
- If this person is trying to GAIN weight: they NEED a calorie surplus. Being in a deficit is BAD for their goal. Eating more clean calories is what they should do. A surplus of 200-500 cal with high protein is ideal for lean bulking.
- If this person is trying to LOSE weight: they NEED a calorie deficit. Being in surplus is BAD. A deficit of 300-600 cal with high protein preserves muscle.
- If trying to cut body fat while gaining/maintaining: high protein is CRITICAL (1g per lb goal weight minimum). Clean food sources matter more.
- Working out is always a positive.
- If nothing or very little was logged, grade "I" for incomplete — do not grade an empty day.
- Every number you mention must be specific to THIS person's targets.

GRADE SCALE: A = crushed it for THEIR goal. B = solid. C = okay but missed key areas. D = off track. F = completely wrong direction. I = incomplete/not logged.

Respond ONLY with raw JSON (no markdown, no backticks, no explanation):
{"grade":"X","summary":"2-3 sentences about how today specifically moved them toward or away from their goal of going from Xlbs to Xlbs at X% body fat. Reference exact calorie/protein numbers vs their targets.","wins":["specific wins with numbers"],"improve":["specific shortfalls with exact numbers they need - e.g. 'You need Xg more protein to hit your Xg target' or 'You need X more calories to be in the surplus needed to gain weight'"],"tip":"One specific food or action for tomorrow with exact macros that addresses their biggest gap today"}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ grade: "C", summary: "Could not grade.", wins: [], improve: [], tip: "" }, { status: 500 });
    }

    const data = await response.json();
    let text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";

    let jsonStr = text;
    const brace = text.match(/\{[\s\S]*\}/);
    if (brace) jsonStr = brace[0];

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

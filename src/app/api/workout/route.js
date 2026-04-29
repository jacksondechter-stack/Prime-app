export async function POST(req) {
  try {
    const body = await req.json();
    const { action, profile } = body;

    if (action === "lookup") {
      return handleLookup(profile, body.query);
    } else if (action === "generate") {
      return handleGenerate(profile);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Workout API error:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

async function callClaude(system, userMsg, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
}

async function handleLookup(profile, query) {
  if (!query || !query.trim()) {
    return Response.json({ error: "No query provided" }, { status: 400 });
  }

  const system = `You are a fitness exercise database. Given an exercise name or description, return ONLY a JSON object with these exact fields:
{
  "name": "Official exercise name",
  "type": "strength" | "cardio" | "sport" | "flexibility",
  "inputMode": "weighted" | "bodyweight" | "time" | "cardio_distance" | "cardio_incline",
  "muscles": ["Primary muscle", "Secondary muscle"],
  "met": <MET value 2-10>,
  "calPerMin": <calories per minute for a ${profile?.weight || 170}lb person>,
  "defaultSets": <recommended number of sets 2-5>,
  "tips": "One sentence form tip"
}

inputMode classification rules (CRITICAL — pick exactly one):
- "weighted": loaded barbell/dumbbell/machine lifts where the user picks the weight (bench press, squat, deadlift, row, overhead press, curl, leg press, lat pulldown, tricep pushdown, etc.)
- "bodyweight": exercises performed with bodyweight as primary resistance, COUNTED IN REPS (pull-ups, dips, push-ups, chin-ups, pistol squats, burpees, mountain climbers, jumping jacks, kettlebell swings, box jumps, jump squats, lunges without weight). The user logs reps per set. They may optionally add weight via a belt/vest.
- "time": static holds counted in seconds (plank, side plank, wall sit, dead hang, L-sit, hollow hold, glute bridge hold, superman hold). NOT for dynamic exercises even if they feel cardio-like.
- "cardio_distance": steady-state cardio with distance tracking (running, cycling, rowing, swimming, elliptical without incline focus). Logged as minutes + distance.
- "cardio_incline": cardio where incline is the key variable (incline treadmill walk, stair master, stair climber, hill running). Logged as minutes + distance + incline%.

If unsure between weighted and bodyweight (e.g., "lunges"), default to "bodyweight" unless the name explicitly includes "dumbbell", "barbell", "weighted", "loaded", etc.
If unsure between bodyweight and time, default to "bodyweight" — only use "time" for true static holds.

Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

  try {
    const text = await callClaude(system, query.trim(), 500);
    const data = JSON.parse(text);
    return Response.json(data);
  } catch {
    return Response.json({ error: "Failed to parse exercise data" }, { status: 500 });
  }
}

async function handleGenerate(profile) {
  if (!profile) {
    return Response.json({ error: "No profile provided" }, { status: 400 });
  }

  const {
    weight, goalWeight, bodyFat, goalBF, sex, age,
    activity, goal, focus, equipment, deadline, time, recentWorkouts, customPrompt,
  } = profile;

  const isCutting = bodyFat && goalBF && +bodyFat > +goalBF;
  const isBulking = goalWeight && weight && +goalWeight > +weight && !isCutting;

  let philosophy = "";
  if (isCutting) {
    const bfDiff = (+bodyFat - +goalBF).toFixed(1);
    philosophy = `This person is CUTTING — lose ${bfDiff}% body fat (${bodyFat}% → ${goalBF}%).
Priorities: preserve muscle with heavy compounds, higher rep isolation, supersets for heart rate, high MET exercises, 60-90s rest, slightly lower volume for recovery on deficit.`;
  } else if (isBulking) {
    philosophy = `This person is BULKING — gain muscle (${weight}lbs → ${goalWeight}lbs).
Priorities: progressive overload with heavy compounds first, 6-10 rep main lifts, 10-15 rep accessories, 2-3 min rest on compounds, 4+ sets on primary movements, stretch under load.`;
  } else {
    philosophy = `This person wants body recomposition — lose fat and build muscle.
Priorities: balance heavy compounds and moderate-rep isolation, mix strength (5-8 reps) and hypertrophy (10-15 reps), include superset pairs, 90-120s rest.`;
  }

  const system = `You are an expert personal trainer. Generate a personalized workout.

CRITICAL: Each exercise in the response MUST include an "inputMode" field with one of these exact values:
- "weighted" → barbell/dumbbell/machine lifts (user picks weight). Examples: bench, squat, row, OHP, curl, leg press.
- "bodyweight" → bodyweight exercises counted in REPS (user may optionally add weight). Examples: pull-ups, dips, push-ups, burpees, mountain climbers, jumping jacks, lunges, box jumps.
- "time" → static holds counted in SECONDS only. Examples: plank, wall sit, dead hang, L-sit. Do NOT use "time" for dynamic exercises like burpees.
- "cardio_distance" → steady-state cardio (min + distance). Examples: running, cycling, rowing.
- "cardio_incline" → cardio where incline matters (min + distance + incline%). Examples: incline treadmill walk, stair master.

If unsure between weighted and bodyweight, default to "bodyweight" unless the name explicitly includes "dumbbell", "barbell", "weighted", "loaded".


${customPrompt ? `USER'S SPECIFIC REQUEST FOR THIS WORKOUT (highest priority - build the workout to match this exact request, even if it deviates from the standard plan):
"${customPrompt}"

Interpret this request literally. If they say "mix push and pull", build a workout combining push and pull movements. If they say "going heavy", use lower reps (3-6) and heavier compound lifts. If they say "end with cardio", append cardio after strength work. If they specify a time limit, fit the workout in that time. If they mention equipment limits or pain/avoidance areas, respect those constraints absolutely.

` : ''}

CLIENT: ${sex || "unspecified"} sex, age ${age || "unspecified"}, ${weight || "?"}lbs → ${goalWeight || "?"}lbs, BF ${bodyFat || "?"}% → ${goalBF || "?"}%, trains ${activity || "3-4x/week"}, ${equipment || "full gym"}, ${time || "45-60 min"} sessions, deadline: ${deadline || "none"}, goal: ${goal || "recomp"}

${philosophy}

FOCUS: ${focus} day
${recentWorkouts ? `AVOID REPEATING: ${recentWorkouts}` : ""}

Return ONLY a JSON object:
{
  "title": "Workout title",
  "exercises": [
    {"name":"Exercise Name","sets":3,"reps":"8-10","type":"strength","muscles":["Primary","Secondary"],"met":5,"notes":"Form cue"}
  ]
}

RULES: 5-7 exercises. First 2-3 compound, last 2-3 isolation. Every exercise needs "notes" with a form cue. MET: compounds 5-6, isolation 3-4. Reps as string range. AVOID recent exercises. Return ONLY valid JSON.`;

  try {
    const text = await callClaude(system, `Generate a ${focus} workout. Return ONLY JSON.`, 1000);
    const data = JSON.parse(text);

    if (!data.exercises || !Array.isArray(data.exercises)) throw new Error("Bad structure");

    data.exercises = data.exercises.map((ex) => ({
      name: ex.name || "Unknown Exercise",
      sets: ex.sets || 3,
      reps: ex.reps || "10-12",
      type: ex.type || "strength",
      muscles: ex.muscles || [],
      met: ex.met || 4,
      notes: ex.notes || "",
    }));

    return Response.json(data);
  } catch {
    const fallbacks = {
      Push: {
        title: "Push Day",
        exercises: [
          {name:"Bench Press",sets:4,reps:"8-10",type:"strength",muscles:["Chest","Triceps"],met:5,notes:"Retract shoulder blades, feet flat"},
          {name:"Overhead Press",sets:3,reps:"8-10",type:"strength",muscles:["Shoulders","Triceps"],met:5,notes:"Brace core, press straight up"},
          {name:"Incline DB Press",sets:3,reps:"10-12",type:"strength",muscles:["Upper Chest"],met:4.5,notes:"30-45 degree angle"},
          {name:"Lateral Raises",sets:3,reps:"12-15",type:"strength",muscles:["Side Delts"],met:3.5,notes:"Slight elbow bend, control descent"},
          {name:"Tricep Pushdowns",sets:3,reps:"12-15",type:"strength",muscles:["Triceps"],met:3,notes:"Elbows pinned at sides"},
          {name:"Overhead Tri Extension",sets:3,reps:"10-12",type:"strength",muscles:["Triceps"],met:3,notes:"Keep elbows close to head"},
        ],
      },
      Pull: {
        title: "Pull Day",
        exercises: [
          {name:"Barbell Rows",sets:4,reps:"8-10",type:"strength",muscles:["Back","Biceps"],met:5,notes:"Hinge at hips, pull to lower chest"},
          {name:"Lat Pulldowns",sets:3,reps:"10-12",type:"strength",muscles:["Lats"],met:4.5,notes:"Pull to upper chest, squeeze lats"},
          {name:"Cable Rows",sets:3,reps:"10-12",type:"strength",muscles:["Mid Back"],met:4,notes:"Squeeze shoulder blades together"},
          {name:"Face Pulls",sets:3,reps:"15-20",type:"strength",muscles:["Rear Delts"],met:3,notes:"Pull to face, external rotate"},
          {name:"Barbell Curls",sets:3,reps:"10-12",type:"strength",muscles:["Biceps"],met:3.5,notes:"Full extension, no swinging"},
          {name:"Hammer Curls",sets:3,reps:"10-12",type:"strength",muscles:["Biceps"],met:3.5,notes:"Neutral grip, control the negative"},
        ],
      },
      Legs: {
        title: "Leg Day",
        exercises: [
          {name:"Squats",sets:4,reps:"8-10",type:"strength",muscles:["Quads","Glutes"],met:6,notes:"Break at hips and knees, chest up"},
          {name:"Romanian Deadlifts",sets:4,reps:"8-10",type:"strength",muscles:["Hams","Glutes"],met:5.5,notes:"Push hips back, slight knee bend"},
          {name:"Leg Press",sets:3,reps:"10-12",type:"strength",muscles:["Quads"],met:5,notes:"Feet shoulder width, full range"},
          {name:"Leg Curls",sets:3,reps:"12-15",type:"strength",muscles:["Hams"],met:3.5,notes:"Squeeze at top, slow negative"},
          {name:"Calf Raises",sets:4,reps:"15-20",type:"strength",muscles:["Calves"],met:3,notes:"Full stretch, pause at top"},
          {name:"Walking Lunges",sets:3,reps:"12 each",type:"strength",muscles:["Glutes","Quads"],met:5,notes:"Long stride, knee over ankle"},
        ],
      },
    };
    return Response.json(fallbacks[focus] || fallbacks.Push);
  }
}

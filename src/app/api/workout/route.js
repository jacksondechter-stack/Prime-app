import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

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

async function handleLookup(profile, query) {
  if (!query || !query.trim()) {
    return Response.json({ error: "No query provided" }, { status: 400 });
  }

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: `You are a fitness exercise database. Given an exercise name or description, return ONLY a JSON object with these exact fields:
{
  "name": "Official exercise name",
  "type": "strength" | "cardio" | "sport" | "flexibility",
  "muscles": ["Primary muscle", "Secondary muscle"],
  "met": <MET value 2-10>,
  "calPerMin": <calories per minute for a ${profile?.weight || 170}lb person>,
  "defaultSets": <recommended number of sets 2-5>,
  "tips": "One sentence form tip"
}
Return ONLY valid JSON. No markdown, no backticks, no explanation.`,
    messages: [{ role: "user", content: query.trim() }],
  });

  try {
    const text = msg.content[0]?.text || "";
    const clean = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(clean);
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Failed to parse exercise data" },
      { status: 500 }
    );
  }
}

async function handleGenerate(profile) {
  if (!profile) {
    return Response.json({ error: "No profile provided" }, { status: 400 });
  }

  const {
    weight,
    goalWeight,
    bodyFat,
    goalBF,
    sex,
    age,
    activity,
    goal,
    focus,
    equipment,
    deadline,
    time,
    recentWorkouts,
  } = profile;

  // Determine training philosophy based on profile
  const isCutting = bodyFat && goalBF && +bodyFat > +goalBF;
  const isBulking = goalWeight && weight && +goalWeight > +weight && !isCutting;

  let philosophy = "";
  if (isCutting) {
    const bfDiff = (+bodyFat - +goalBF).toFixed(1);
    philosophy = `This person is CUTTING — they need to lose ${bfDiff}% body fat (currently ${bodyFat}%, target ${goalBF}%).
Programming priorities:
- Preserve muscle with heavy compound lifts (maintain strength)
- Higher rep ranges on isolation work (metabolic stress)
- Include 1-2 supersets or circuits to keep heart rate elevated
- Favor exercises with high MET values for calorie burn
- Keep rest periods moderate (60-90 seconds)
- Total volume slightly lower than a bulk to manage recovery on a deficit`;
  } else if (isBulking) {
    philosophy = `This person is BULKING — they want to gain muscle (${weight}lbs → ${goalWeight}lbs).
Programming priorities:
- Progressive overload focus — heavy compound movements first
- Lower rep ranges (6-10) on main lifts for strength
- Moderate rep ranges (10-15) on accessories for hypertrophy
- Longer rest periods (2-3 minutes on compounds)
- Higher total volume — 4+ sets on primary movements
- Include exercises that stretch the muscle under load`;
  } else {
    philosophy = `This person wants body recomposition — lose fat and build muscle simultaneously.
Programming priorities:
- Balance of heavy compounds and moderate-rep isolation
- Mix of strength (5-8 reps) and hypertrophy (10-15 reps)
- Include at least one superset pair for conditioning
- Moderate rest periods (90-120 seconds)`;
  }

  const systemPrompt = `You are an expert personal trainer and exercise programmer. Generate a personalized workout plan.

CLIENT PROFILE:
- Sex: ${sex || "not specified"}, Age: ${age || "not specified"}
- Current weight: ${weight || "not specified"}lbs
- Goal weight: ${goalWeight || "not specified"}lbs
- Current body fat: ${bodyFat || "not specified"}%
- Goal body fat: ${goalBF || "not specified"}%
- Training frequency: ${activity || "3-4x/week"}
- Equipment: ${equipment || "full gym"}
- Session length: ${time || "45-60 min"}
- Deadline: ${deadline || "not specified"}
- Goal: ${goal || "body recomposition"}

${philosophy}

WORKOUT FOCUS: ${focus} day

${recentWorkouts ? `RECENT EXERCISES (avoid repeating these): ${recentWorkouts}` : ""}

Return ONLY a JSON object with this exact structure:
{
  "title": "Workout title (e.g. 'Heavy Pull — Back & Biceps')",
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": 3,
      "reps": "8-10",
      "type": "strength",
      "muscles": ["Primary Muscle", "Secondary Muscle"],
      "met": 5,
      "notes": "One line form cue or coaching note"
    }
  ]
}

RULES:
- Generate exactly 5-7 exercises
- First 2-3 should be compound movements
- Last 2-3 should be isolation/accessory work
- Every exercise MUST have a "notes" field with a specific form cue
- MET values: compound lifts 5-6, machines/isolation 3-4, bodyweight 4-5
- "muscles" should list the primary muscle group first
- Reps as a string range like "8-10" or "12-15"
- If the person is cutting, bias toward higher MET compound exercises
- If bulking, bias toward heavy compounds with more sets
- AVOID exercises from the recent exercises list
- Return ONLY valid JSON. No markdown, no backticks.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Generate a ${focus} workout for this client. Remember: return ONLY the JSON object.`,
      },
    ],
  });

  try {
    const text = msg.content[0]?.text || "";
    const clean = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(clean);

    // Validate the response has the expected structure
    if (!data.exercises || !Array.isArray(data.exercises)) {
      throw new Error("Invalid response structure");
    }

    // Ensure each exercise has required fields with defaults
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
    // Fallback: return a generic workout so the user isn't left hanging
    const fallbacks = {
      Push: {
        title: "Push Day",
        exercises: [
          { name: "Bench Press", sets: 4, reps: "8-10", type: "strength", muscles: ["Chest", "Triceps"], met: 5, notes: "Retract shoulder blades, feet flat" },
          { name: "Overhead Press", sets: 3, reps: "8-10", type: "strength", muscles: ["Shoulders", "Triceps"], met: 5, notes: "Brace core, press straight up" },
          { name: "Incline DB Press", sets: 3, reps: "10-12", type: "strength", muscles: ["Upper Chest"], met: 4.5, notes: "30-45 degree angle" },
          { name: "Lateral Raises", sets: 3, reps: "12-15", type: "strength", muscles: ["Side Delts"], met: 3.5, notes: "Slight elbow bend, control descent" },
          { name: "Tricep Pushdowns", sets: 3, reps: "12-15", type: "strength", muscles: ["Triceps"], met: 3, notes: "Elbows pinned at sides" },
          { name: "Overhead Tri Extension", sets: 3, reps: "10-12", type: "strength", muscles: ["Triceps"], met: 3, notes: "Keep elbows close to head" },
        ],
      },
      Pull: {
        title: "Pull Day",
        exercises: [
          { name: "Barbell Rows", sets: 4, reps: "8-10", type: "strength", muscles: ["Back", "Biceps"], met: 5, notes: "Hinge at hips, pull to lower chest" },
          { name: "Lat Pulldowns", sets: 3, reps: "10-12", type: "strength", muscles: ["Lats"], met: 4.5, notes: "Pull to upper chest, squeeze lats" },
          { name: "Cable Rows", sets: 3, reps: "10-12", type: "strength", muscles: ["Mid Back"], met: 4, notes: "Squeeze shoulder blades together" },
          { name: "Face Pulls", sets: 3, reps: "15-20", type: "strength", muscles: ["Rear Delts"], met: 3, notes: "Pull to face, external rotate" },
          { name: "Barbell Curls", sets: 3, reps: "10-12", type: "strength", muscles: ["Biceps"], met: 3.5, notes: "Full extension, no swinging" },
          { name: "Hammer Curls", sets: 3, reps: "10-12", type: "strength", muscles: ["Biceps"], met: 3.5, notes: "Neutral grip, control the negative" },
        ],
      },
      Legs: {
        title: "Leg Day",
        exercises: [
          { name: "Squats", sets: 4, reps: "8-10", type: "strength", muscles: ["Quads", "Glutes"], met: 6, notes: "Break at hips and knees, chest up" },
          { name: "Romanian Deadlifts", sets: 4, reps: "8-10", type: "strength", muscles: ["Hams", "Glutes"], met: 5.5, notes: "Push hips back, slight knee bend" },
          { name: "Leg Press", sets: 3, reps: "10-12", type: "strength", muscles: ["Quads"], met: 5, notes: "Feet shoulder width, full range" },
          { name: "Leg Curls", sets: 3, reps: "12-15", type: "strength", muscles: ["Hams"], met: 3.5, notes: "Squeeze at top, slow negative" },
          { name: "Calf Raises", sets: 4, reps: "15-20", type: "strength", muscles: ["Calves"], met: 3, notes: "Full stretch, pause at top" },
          { name: "Walking Lunges", sets: 3, reps: "12 each", type: "strength", muscles: ["Glutes", "Quads"], met: 5, notes: "Long stride, knee over ankle" },
        ],
      },
    };

    const fallback = fallbacks[focus] || fallbacks.Push;
    return Response.json(fallback);
  }
}

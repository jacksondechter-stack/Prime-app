import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { image, weight, height, age, sex, context } = await request.json();
    if (!image) return NextResponse.json({ error: 'Image required' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const heightStr = height ? `${Math.floor(height/12)}'${height%12}"` : 'unknown height';

    const prompt = context === 'goal' 
      ? `You are a fitness expert analyzing a goal/inspiration physique photo. Based on the visible muscle definition, body proportions, and leanness in this image, estimate the body fat percentage AND a realistic goal weight for someone who is ${sex}, ${age} years old, ${heightStr} tall, currently weighing ${weight} lbs. What would they likely weigh if they achieved this physique? Respond with ONLY a JSON object: {"bf": 14, "goalWeight": 155, "label": "Athletic", "note": "Visible ab definition with good muscle mass. For your frame, achieving this physique would likely put you around 155 lbs at approximately 14% body fat."}`
      : `You are a fitness expert analyzing a current physique photo. Based on the visible body composition - looking at muscle definition, fat distribution, abdominal visibility, and overall proportions - estimate this person's body fat percentage. They are ${sex}, ${age} years old, ${heightStr} tall, weighing ${weight} lbs. Respond with ONLY a JSON object: {"bf": 22, "label": "Average", "note": "Moderate fat covering with some muscle definition visible suggests approximately 22% body fat"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    
    console.log('Claude API status:', response.status);
    console.log('Claude API response:', JSON.stringify(data).substring(0, 500));

    if (data.error) {
      return NextResponse.json({ error: data.error.message || 'API error', detail: data.error.type }, { status: 500 });
    }

    const text = data.content?.[0]?.text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return NextResponse.json(result);
    }
    
    return NextResponse.json({ error: 'Could not parse response', raw: text.substring(0, 200) }, { status: 500 });
  } catch (e) {
    console.error('Analyze error:', e);
    return NextResponse.json({ error: 'Server error: ' + e.message }, { status: 500 });
  }
}

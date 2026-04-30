import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const { query } = await request.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ answer: 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env.local.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: query }],
    });

    const answer = completion.choices[0].message.content;
    return NextResponse.json({ answer });
  } catch (error) {
    console.error('OpenAI error:', error);
    return NextResponse.json({ answer: 'Error fetching response from AI.' });
  }
}
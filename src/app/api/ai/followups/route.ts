import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ai } from '@/lib/ai'

const schema = z.object({ text: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text } = schema.parse(body)
    const result = await ai.generateFollowupQuestions(text)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { login, encodeSession } from '@/lib/auth'

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const COOKIE_NAME = 'pubtech_session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = schema.parse(body)

    const user = await login(username, password)
    if (!user) {
      return NextResponse.json({ error: 'ユーザー名またはパスワードが正しくありません' }, { status: 401 })
    }

    const encoded = encodeSession(user)
    const res = NextResponse.json({ user })
    res.cookies.set(COOKIE_NAME, encoded, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

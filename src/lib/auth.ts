import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export interface SessionUser {
  id: string
  username: string
  dept: string
  role: string
}

const COOKIE_NAME = 'pubtech_session'

export function encodeSession(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64')
}

export function decodeSession(value: string): SessionUser | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as SessionUser
  } catch {
    return null
  }
}

export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  if (!cookie) return null
  return decodeSession(cookie.value)
}

export function getRequestSession(req: NextRequest): SessionUser | null {
  const cookie = req.cookies.get(COOKIE_NAME)
  if (!cookie) return null
  return decodeSession(cookie.value)
}

export async function login(username: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return null
  return { id: user.id, username: user.username, dept: user.dept, role: user.role }
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME

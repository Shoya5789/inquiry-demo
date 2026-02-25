import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/staff', '/admin']
const COOKIE_NAME = 'pubtech_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected) {
    // ログインページは除外
    if (pathname === '/staff/login') return NextResponse.next()

    const session = request.cookies.get(COOKIE_NAME)
    if (!session) {
      return NextResponse.redirect(new URL('/staff/login', request.url))
    }

    // admin/* は role=admin のみ
    if (pathname.startsWith('/admin')) {
      try {
        const user = JSON.parse(Buffer.from(session.value, 'base64').toString('utf8'))
        if (user.role !== 'admin') {
          return NextResponse.redirect(new URL('/staff', request.url))
        }
      } catch {
        return NextResponse.redirect(new URL('/staff/login', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/staff/:path*', '/admin/:path*'],
}

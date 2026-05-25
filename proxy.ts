import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Skip Next.js internals, static assets, PWA files, and known public files
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|icons/|sw\\.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

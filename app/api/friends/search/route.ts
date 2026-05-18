import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  // Collect IDs of users who already have any friendship row with the current user
  const { data: existing } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

  const excludeIds = new Set<string>([user.id])
  ;(existing ?? []).forEach(f => {
    excludeIds.add(f.user_id)
    excludeIds.add(f.friend_id)
  })

  // Search profiles by email or display_name (RLS allows authenticated users to read all profiles)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(20)

  const results = (profiles ?? [])
    .filter(p => !excludeIds.has(p.id))
    .slice(0, 10)

  return NextResponse.json(results)
}

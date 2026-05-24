import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/friends/pending — incoming pending friend requests for the current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at')
    .eq('friend_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (!friendships?.length) return NextResponse.json([])

  const requesterIds = friendships.map(f => f.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .in('id', requesterIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return NextResponse.json(friendships.map(f => ({ ...f, profile: profileMap.get(f.user_id) })))
}

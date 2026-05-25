import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/friends/nicknames
// Returns { [friend_id]: nickname } for the authenticated user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({}, { status: 401 })

  const { data } = await supabase
    .from('friend_nicknames')
    .select('friend_id, nickname')
    .eq('user_id', user.id)

  const result = Object.fromEntries((data ?? []).map(r => [r.friend_id, r.nickname]))
  return NextResponse.json(result)
}

// PUT /api/friends/nicknames
// Body: { friend_id, nickname }
// Upserts the nickname; deletes the row if nickname is empty
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friend_id, nickname } = await request.json()
  if (!friend_id) return NextResponse.json({ error: 'Missing friend_id' }, { status: 400 })

  if (!nickname || !nickname.trim()) {
    // Empty nickname — remove it
    await supabase
      .from('friend_nicknames')
      .delete()
      .eq('user_id', user.id)
      .eq('friend_id', friend_id)
  } else {
    await supabase
      .from('friend_nicknames')
      .upsert(
        { user_id: user.id, friend_id, nickname: nickname.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,friend_id' }
      )
  }

  return NextResponse.json({ ok: true })
}

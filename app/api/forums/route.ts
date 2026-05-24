import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/forums — list all active forums the current user belongs to
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data: memberships } = await supabase
    .from('forum_members')
    .select('forum_id')
    .eq('user_id', user.id)

  if (!memberships?.length) return NextResponse.json([])

  const forumIds = memberships.map(m => m.forum_id)

  const { data: forums, error } = await supabase
    .from('forums')
    .select('*, book:books(*)')
    .in('id', forumIds)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false })

  if (error || !forums) return NextResponse.json([])

  const { data: members } = await supabase
    .from('forum_members')
    .select('forum_id, user_id, joined_at')
    .in('forum_id', forumIds)

  const memberUserIds = [...new Set((members ?? []).map(m => m.user_id))]
  const { data: profiles } = memberUserIds.length
    ? await supabase
        .from('profiles')
        .select('id, email, display_name, created_at')
        .in('id', memberUserIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const result = forums.map(f => ({
    ...f,
    members: (members ?? [])
      .filter(m => m.forum_id === f.id)
      .map(m => ({ ...m, profile: profileMap.get(m.user_id) })),
  }))

  return NextResponse.json(result)
}

// POST /api/forums — create a new forum
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { book_id, friend_ids } = await request.json() as { book_id: string; friend_ids: string[] }
  if (!book_id || !Array.isArray(friend_ids) || friend_ids.length === 0) {
    return NextResponse.json({ error: 'Missing book_id or friend_ids' }, { status: 400 })
  }

  const proposedMembers = new Set([user.id, ...friend_ids])

  // Duplicate check: any active forum for this book with the exact same member set?
  const { data: existingForums } = await supabase
    .from('forums')
    .select('id')
    .eq('book_id', book_id)
    .eq('is_active', true)

  if (existingForums?.length) {
    const { data: existingMembers } = await supabase
      .from('forum_members')
      .select('forum_id, user_id')
      .in('forum_id', existingForums.map(f => f.id))

    const forumMemberMap = new Map<string, Set<string>>()
    for (const m of (existingMembers ?? [])) {
      if (!forumMemberMap.has(m.forum_id)) forumMemberMap.set(m.forum_id, new Set())
      forumMemberMap.get(m.forum_id)!.add(m.user_id)
    }

    for (const [, memberSet] of forumMemberMap) {
      if (
        memberSet.size === proposedMembers.size &&
        [...proposedMembers].every(id => memberSet.has(id))
      ) {
        return NextResponse.json(
          { error: 'A forum for this book with these exact people already exists.' },
          { status: 409 }
        )
      }
    }
  }

  const { data: forum, error: forumErr } = await supabase
    .from('forums')
    .insert({ book_id, created_by: user.id })
    .select('*, book:books(*)')
    .single()

  if (forumErr || !forum) {
    return NextResponse.json({ error: forumErr?.message ?? 'Failed to create forum', code: forumErr?.code }, { status: 500 })
  }

  await supabase
    .from('forum_members')
    .insert([...proposedMembers].map(uid => ({ forum_id: forum.id, user_id: uid })))

  return NextResponse.json(forum, { status: 201 })
}

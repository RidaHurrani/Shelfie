import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/forums/[id]/messages
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data: messages, error } = await supabase
    .from('forum_messages')
    .select('id, forum_id, user_id, content, created_at')
    .eq('forum_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json([], { status: 500 })
  if (!messages?.length) return NextResponse.json([])

  const senderIds = [...new Set(messages.map(m => m.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .in('id', senderIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  return NextResponse.json(messages.map(m => ({ ...m, profile: profileMap.get(m.user_id) })))
}

// POST /api/forums/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await request.json() as { content: string }
  if (!content?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const { data: message, error } = await supabase
    .from('forum_messages')
    .insert({ forum_id: id, user_id: user.id, content: content.trim() })
    .select('id, forum_id, user_id, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('forums')
    .update({ last_message_at: message.created_at })
    .eq('id', id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ ...message, profile }, { status: 201 })
}

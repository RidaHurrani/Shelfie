import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/forums/[id]/invite — add a member (creator only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: forum } = await supabase
    .from('forums')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!forum || forum.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id } = await request.json() as { user_id: string }
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .eq('id', user_id)
    .single()

  const { error } = await supabase
    .from('forum_members')
    .insert({ forum_id: id, user_id })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already a member' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ forum_id: id, user_id, joined_at: new Date().toISOString(), profile })
}

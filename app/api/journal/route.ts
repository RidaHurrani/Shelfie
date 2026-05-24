import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/journal?book_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ content: '' }, { status: 401 })

  const book_id = request.nextUrl.searchParams.get('book_id')
  if (!book_id) return NextResponse.json({ content: '' }, { status: 400 })

  const { data } = await supabase
    .from('journal_entries')
    .select('content')
    .eq('user_id', user.id)
    .eq('book_id', book_id)
    .single()

  return NextResponse.json({ content: data?.content ?? '' })
}

// PUT /api/journal — upsert
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { book_id, content } = await request.json() as { book_id: string; content: string }
  if (!book_id) return NextResponse.json({ error: 'Missing book_id' }, { status: 400 })

  const { error } = await supabase
    .from('journal_entries')
    .upsert(
      { user_id: user.id, book_id, content: content ?? '', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,book_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

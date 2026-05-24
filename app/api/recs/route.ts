import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/recs — friend recommendations received by the current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data: recs } = await supabase
    .from('recommendations')
    .select('id, user_id, book_id, recipient_id, user_rating, note, created_at, book:books(*)')
    .neq('user_id', user.id)
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })

  if (!recs?.length) return NextResponse.json([])

  const recommenderIds = [...new Set(recs.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .in('id', recommenderIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return NextResponse.json(recs.map(r => ({ ...r, recommender: profileMap.get(r.user_id) })))
}

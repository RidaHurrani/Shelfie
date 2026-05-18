import { createClient } from './supabase/server'
import { SectionWithEntries, Friendship, Recommendation } from './types'

export async function getSectionsWithEntries(userId: string): Promise<SectionWithEntries[]> {
  const supabase = await createClient()

  const { data: sections, error: secErr } = await supabase
    .from('sections')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })

  if (secErr || !sections) return []

  const { data: entries, error: entErr } = await supabase
    .from('shelf_entries')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .order('shelf_index', { ascending: true })
    .order('position', { ascending: true })

  if (entErr || !entries) {
    return sections.map((s) => ({ ...s, entries: [] }))
  }

  return sections.map((section) => ({
    ...section,
    entries: entries.filter((e) => e.section_id === section.id),
  }))
}

// ── Social queries ─────────────────────────────────────────────────────────────

/** Recommendations from all accepted friends, newest first. */
export async function getFriendsRecommendations(userId: string): Promise<Recommendation[]> {
  const supabase = await createClient()

  const { data: recs } = await supabase
    .from('recommendations')
    .select('id, user_id, book_id, user_rating, note, created_at, book:books(*)')
    .neq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!recs?.length) return []

  const recommenderIds = [...new Set(recs.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .in('id', recommenderIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return recs.map(r => ({
    ...r,
    recommender: profileMap.get(r.user_id),
  })) as unknown as Recommendation[]
}

/** Accepted friendships with the other person's profile. */
export async function getAcceptedFriends(userId: string): Promise<Friendship[]> {
  const supabase = await createClient()

  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

  if (!friendships?.length) return []

  const otherIds = friendships.map(f => f.user_id === userId ? f.friend_id : f.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .in('id', [...new Set(otherIds)])

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return friendships.map(f => ({
    ...f,
    profile: profileMap.get(f.user_id === userId ? f.friend_id : f.user_id)!,
  })) as Friendship[]
}

/** Incoming pending friend requests (other users who sent a request to me). */
export async function getPendingFriendRequests(userId: string): Promise<Friendship[]> {
  const supabase = await createClient()

  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at')
    .eq('friend_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (!friendships?.length) return []

  const requesterIds = friendships.map(f => f.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at')
    .in('id', requesterIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return friendships.map(f => ({
    ...f,
    profile: profileMap.get(f.user_id)!,
  })) as Friendship[]
}

/** Current user's own recommendations (book_id only needed for toggle state). */
export async function getMyRecommendations(userId: string): Promise<Pick<Recommendation, 'id' | 'book_id'>[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('recommendations')
    .select('id, book_id')
    .eq('user_id', userId)

  return (data ?? []) as Pick<Recommendation, 'id' | 'book_id'>[]
}

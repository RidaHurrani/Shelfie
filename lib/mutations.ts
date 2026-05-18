import { createClient } from './supabase/client'
import { GoogleBookResult, ShelfEntry, Recommendation } from './types'

export class DuplicateBookError extends Error {
  constructor() { super('This book is already on this shelf') }
}

export async function addBookToSection(
  book: GoogleBookResult,
  sectionId: string,
  userId: string,
  currentCount: number,
  spineColor: string,
  seriesName?: string | null,
  shelfIndex: number = 0,
  readingStatus: string = 'want_to_read'
) {
  const supabase = createClient()

  // Upsert book into global catalog
  const { data: bookRow, error: bookErr } = await supabase
    .from('books')
    .upsert(
      {
        google_books_id: book.id,
        title: book.title,
        authors: book.authors,
        description: book.description,
        cover_url: book.thumbnail,
        cover_url_large: book.thumbnailLarge,
        average_rating: book.averageRating,
        isbn: book.isbn,
        published_year: book.publishedYear,
        page_count: book.pageCount,
      },
      { onConflict: 'google_books_id' }
    )
    .select('id')
    .single()

  let finalBookId: string
  if (bookErr || !bookRow) {
    const { data: existing } = await supabase
      .from('books')
      .select('id')
      .eq('google_books_id', book.id)
      .single()
    if (!existing) throw new Error('Failed to upsert book')
    finalBookId = existing.id
  } else {
    finalBookId = bookRow.id
  }

  const { data: entry, error: entryErr } = await supabase
    .from('shelf_entries')
    .insert({
      user_id: userId,
      section_id: sectionId,
      book_id: finalBookId,
      spine_color: spineColor,
      position: currentCount,
      series_name: seriesName || null,
      shelf_index: shelfIndex,
      reading_status: readingStatus,
    })
    .select('*, book:books(*)')
    .single()

  if (entryErr) {
    if (entryErr.code === '23505') throw new DuplicateBookError()
    throw new Error(entryErr.message)
  }
  return entry
}

export async function updateRating(entryId: string, rating: number) {
  const supabase = createClient()
  const { error } = await supabase
    .from('shelf_entries')
    .update({ user_rating: rating })
    .eq('id', entryId)
  if (error) throw new Error(error.message)
}

export async function removeBookFromShelf(entryId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('shelf_entries')
    .delete()
    .eq('id', entryId)
  if (error) throw new Error(error.message)
}

export async function moveBookToSection(
  entryId: string,
  toSectionId: string,
  newPosition: number
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('shelf_entries')
    .update({ section_id: toSectionId, position: newPosition })
    .eq('id', entryId)
  if (error) throw new Error(error.message)
}

export async function updateShelfEntry(
  entryId: string,
  spineColor: string,
  customTitle: string | null,
  seriesName?: string | null,
  readingStatus?: string
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('shelf_entries')
    .update({
      spine_color: spineColor,
      custom_title: customTitle || null,
      series_name: seriesName !== undefined ? (seriesName || null) : undefined,
      ...(readingStatus !== undefined && {
        reading_status: readingStatus,
        read_at: readingStatus === 'read' ? new Date().toISOString() : null,
      }),
    })
    .eq('id', entryId)
  if (error) throw new Error(error.message)
}

export async function moveToShelf(entryId: string, shelfIndex: number, newPosition: number) {
  const supabase = createClient()
  const { error } = await supabase
    .from('shelf_entries')
    .update({ shelf_index: shelfIndex, position: newPosition })
    .eq('id', entryId)
  if (error) throw new Error(error.message)
}

export async function reorderSection(updates: { id: string; position: number }[]) {
  const supabase = createClient()
  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('shelf_entries').update({ position }).eq('id', id)
    )
  )
}

export async function createSection(userId: string, name: string, displayOrder: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sections')
    .insert({ user_id: userId, name, display_order: displayOrder })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteSection(sectionId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('sections')
    .delete()
    .eq('id', sectionId)
  if (error) throw new Error(error.message)
}

// ── Social / Friends mutations ─────────────────────────────────────────────────

export async function sendFriendRequest(userId: string, toUserId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_id: toUserId })
  if (error) throw new Error(error.message)
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
  if (error) throw new Error(error.message)
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
  if (error) throw new Error(error.message)
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
  if (error) throw new Error(error.message)
}

export async function createRecommendation(
  userId: string,
  bookId: string,
  rating: number | null,
  note?: string
): Promise<Pick<Recommendation, 'id' | 'book_id'>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recommendations')
    .insert({ user_id: userId, book_id: bookId, user_rating: rating, note: note ?? null })
    .select('id, book_id')
    .single()
  if (error) throw new Error(error.message)
  return data as Pick<Recommendation, 'id' | 'book_id'>
}

export async function removeRecommendation(recId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('recommendations')
    .delete()
    .eq('id', recId)
  if (error) throw new Error(error.message)
}

/** Add a book that already exists in the `books` table directly to a shelf entry.
 *  Used when adding a friend's recommendation to your own library — skips the
 *  Google Books upsert step since the book row is already there. */
export async function addBookFromRecommendation(
  bookId: string,
  sectionId: string,
  userId: string,
  position: number,
  spineColor: string,
  readingStatus: string = 'want_to_read'
): Promise<ShelfEntry> {
  const supabase = createClient()
  const { data: entry, error } = await supabase
    .from('shelf_entries')
    .insert({
      user_id:    userId,
      section_id: sectionId,
      book_id:    bookId,
      spine_color: spineColor,
      position,
      shelf_index: 0,
      reading_status: readingStatus,
    })
    .select('*, book:books(*)')
    .single()
  if (error) {
    if (error.code === '23505') throw new DuplicateBookError()
    throw new Error(error.message)
  }
  return entry as ShelfEntry
}

export interface Book {
  id: string
  google_books_id: string
  title: string
  authors: string[]
  description: string | null
  cover_url: string | null
  cover_url_large: string | null
  average_rating: number | null
  isbn: string | null
  published_year: string | null
  page_count: number | null
  created_at: string
}

export interface Section {
  id: string
  user_id: string
  name: string
  display_order: number
  created_at: string
}

export interface ShelfEntry {
  id: string
  user_id: string
  section_id: string
  book_id: string
  user_rating: number | null
  date_added: string
  position: number
  spine_color: string | null
  custom_title: string | null
  series_name: string | null
  shelf_index: number
  book: Book
}

export interface SectionWithEntries extends Section {
  entries: ShelfEntry[]
}

// ── Social / Friends ──────────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  display_name: string | null
  created_at: string
}

export interface Friendship {
  id: string
  user_id: string
  friend_id: string
  status: 'pending' | 'accepted'
  created_at: string
  profile: Profile   // the OTHER person's profile (populated in queries)
}

export interface Recommendation {
  id: string
  user_id: string
  book_id: string
  user_rating: number | null
  note: string | null
  created_at: string
  book: Book
  recommender?: Profile  // present for friends' recs; absent for own
}

export interface GoogleBookResult {
  id: string
  title: string
  authors: string[]
  description: string | null
  thumbnail: string | null
  thumbnailLarge: string | null
  averageRating: number | null
  isbn: string | null
  publishedYear: string | null
  pageCount: number | null
}

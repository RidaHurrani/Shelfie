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

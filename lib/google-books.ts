import { GoogleBookResult } from './types'

function fixImageUrl(url: string | undefined): string | null {
  if (!url) return null
  return url.replace(/^http:\/\//, 'https://')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseVolume(item: any): GoogleBookResult {
  const info = item.volumeInfo ?? {}
  const images = info.imageLinks ?? {}

  const thumbnail = fixImageUrl(images.thumbnail || images.smallThumbnail)
  const thumbnailLarge = thumbnail
    ? thumbnail.replace('zoom=1', 'zoom=3').replace('&edge=curl', '') + '&fife=w400'
    : null

  const isbn =
    (info.industryIdentifiers ?? []).find(
      (id: { type: string }) => id.type === 'ISBN_13' || id.type === 'ISBN_10'
    )?.identifier ?? null

  return {
    id: item.id,
    title: info.title ?? 'Unknown Title',
    authors: info.authors ?? [],
    description: info.description ?? null,
    thumbnail,
    thumbnailLarge,
    averageRating: info.averageRating ?? null,
    isbn,
    publishedYear: info.publishedDate?.substring(0, 4) ?? null,
    pageCount: info.pageCount ?? null,
  }
}

export async function searchBooks(query: string): Promise<GoogleBookResult[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12&printType=books${apiKey ? `&key=${apiKey}` : ''}`

  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) return []

  const data = await res.json()
  return (data.items ?? []).map(parseVolume)
}

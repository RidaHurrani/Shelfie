import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SPINE_PALETTE = [
  '#8B2635', '#2D5A8E', '#4A7C59', '#7B4F8E',
  '#C4762A', '#2D7D7D', '#8E4A3C', '#4A6B8E',
  '#6B8E4A', '#8E6B2D', '#3C4A8E', '#8E3C6B',
  '#5A7A3A', '#8E5A2D', '#5C3D8E', '#6B2D8E',
]

export function generateSpineColor(googleBooksId: string): string {
  let hash = 0
  for (let i = 0; i < googleBooksId.length; i++) {
    hash = googleBooksId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SPINE_PALETTE[Math.abs(hash) % SPINE_PALETTE.length]
}

export function chunkIntoShelves<T>(arr: T[], size = 10): T[][] {
  if (arr.length === 0) return [[]]
  return Array.from(
    { length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, i * size + size)
  )
}

/** How many 30px book spines (+ 4px gap) fit in the given column width (32px total padding). */
export function computeBooksPerShelf(columnWidth: number): number {
  return Math.max(1, Math.floor((columnWidth - 32) / 34))
}

export type ReadingStatus = 'want_to_read' | 'reading' | 'read'

export const READING_STATUSES: {
  value: ReadingStatus
  label: string
  color: string
  bg: string
}[] = [
  { value: 'want_to_read', label: 'Want to Read', color: '#A08060', bg: 'rgba(74,44,20,0.4)'    },
  { value: 'reading',      label: 'Reading',       color: '#D4A55A', bg: 'rgba(212,165,90,0.2)' },
  { value: 'read',         label: 'Read',           color: '#4A7C59', bg: 'rgba(74,124,89,0.25)' },
]

export function spineHeight(pageCount: number | null): number {
  if (!pageCount) return 140
  if (pageCount < 200) return 120
  if (pageCount < 400) return 150
  if (pageCount < 600) return 170
  return 185
}

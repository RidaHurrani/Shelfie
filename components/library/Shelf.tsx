"use client"
import { useState } from "react"
import { ShelfEntry } from "@/lib/types"
import BookSpine from "./BookSpine"

interface ShelfProps {
  books: ShelfEntry[]
  onBookClick: (entry: ShelfEntry) => void
  hoveredSeries?: string | null
  onSeriesEnter?: (series: string) => void
  onSeriesLeave?: () => void
  onDropOnSpine?: (draggedId: string, targetId: string, before: boolean) => void
  // Cross-shelf / same-shelf empty-area drop support
  shelfIndex?: number
  sectionId?: string
  onDropOnShelf?: (entryId: string, targetShelfIndex: number) => void
}

export default function Shelf({
  books,
  onBookClick,
  hoveredSeries,
  onSeriesEnter,
  onSeriesLeave,
  onDropOnSpine,
  shelfIndex,
  sectionId,
  onDropOnShelf,
}: ShelfProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (shelfIndex !== undefined) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when the drag truly leaves this plank (not when entering a child spine)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false)
    if (shelfIndex === undefined || !sectionId) return
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        entryId: string
        fromSectionId: string
        fromShelfIndex: number
      }
      const isSameSection = data.fromSectionId === sectionId
      if (isSameSection) {
        // Handles two cases:
        //   1. Cross-bookcase drop  → move book to this bookcase
        //   2. Same-bookcase empty-area drop → append to end of this bookcase
        //      (BookSpine already stopPropagation'd same-bookcase spine-to-spine
        //       reorders, so this only fires for empty-area drops.)
        e.preventDefault()
        e.stopPropagation()
        onDropOnShelf?.(data.entryId, shelfIndex)
      }
      // Cross-section drops bubble up to SectionColumn
    } catch {
      // malformed
    }
  }

  const enabled = shelfIndex !== undefined

  return (
    <div
      className="shelf-plank min-h-[140px]"
      style={
        isDragOver
          ? { outline: '1px solid rgba(212,165,90,0.25)', outlineOffset: '-1px' }
          : undefined
      }
      onDragOver={enabled ? handleDragOver : undefined}
      onDragEnter={enabled ? handleDragEnter : undefined}
      onDragLeave={enabled ? handleDragLeave : undefined}
      onDrop={enabled ? handleDrop : undefined}
    >
      {books.map((entry) => (
        <BookSpine
          key={entry.id}
          entry={entry}
          onClick={() => onBookClick(entry)}
          hoveredSeries={hoveredSeries}
          onSeriesEnter={onSeriesEnter}
          onSeriesLeave={onSeriesLeave}
          onDropOnSpine={onDropOnSpine}
        />
      ))}
    </div>
  )
}

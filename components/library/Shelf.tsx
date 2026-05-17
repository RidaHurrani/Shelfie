"use client"
import { ShelfEntry } from "@/lib/types"
import BookSpine from "./BookSpine"

interface ShelfProps {
  books: ShelfEntry[]
  onBookClick: (entry: ShelfEntry) => void
  hoveredSeries?: string | null
  onSeriesEnter?: (series: string) => void
  onSeriesLeave?: () => void
  onDropOnSpine?: (draggedId: string, targetId: string, before: boolean) => void
}

export default function Shelf({ books, onBookClick, hoveredSeries, onSeriesEnter, onSeriesLeave, onDropOnSpine }: ShelfProps) {
  return (
    <div className="shelf-plank min-h-[140px]">
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

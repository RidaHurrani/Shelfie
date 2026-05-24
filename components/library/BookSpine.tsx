"use client"
import { useState } from "react"
import { ShelfEntry } from "@/lib/types"
import { spineHeight } from "@/lib/utils"

interface BookSpineProps {
  entry: ShelfEntry
  onClick: () => void
  hoveredSeries?: string | null
  onSeriesEnter?: (series: string) => void
  onSeriesLeave?: () => void
  onDropOnSpine?: (draggedId: string, targetId: string, before: boolean) => void
  isFiltered?: boolean
}

export default function BookSpine({
  entry,
  onClick,
  hoveredSeries,
  onSeriesEnter,
  onSeriesLeave,
  onDropOnSpine,
  isFiltered = true,
}: BookSpineProps) {
  const isCoverMode = entry.spine_color === 'cover' && !!entry.book.cover_url
  const color = isCoverMode ? '#1C0E06' : (entry.spine_color ?? '#5A3A20')
  const height = spineHeight(entry.book.page_count)
  const title = entry.custom_title ?? entry.book.title
  const author = entry.book.authors[0] ?? ''
  const isSeriesHighlighted = !!(hoveredSeries && entry.series_name && entry.series_name === hoveredSeries)
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverSide, setDragOverSide] = useState<'before' | 'after' | null>(null)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        entryId: entry.id,
        fromSectionId: entry.section_id,
        fromShelfIndex: entry.shelf_index ?? 0,
      })
    )
    e.dataTransfer.effectAllowed = 'move'
    // Defer so the browser captures the full-opacity ghost image first
    requestAnimationFrame(() => setIsDragging(true))
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragOverSide(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOverSide(e.clientX < rect.left + rect.width / 2 ? 'before' : 'after')
  }

  // Only clear the indicator when leaving the spine itself, not when entering
  // a child element (title span, cover image, etc.).
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSide(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverSide(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        entryId: string
        fromSectionId: string
        fromShelfIndex: number
      }
      const isSameSection = data.fromSectionId === entry.section_id
      const isSameShelf = (data.fromShelfIndex ?? 0) === (entry.shelf_index ?? 0)
      // In unfiltered mode, shelf_index is a virtual row index, so allow
      // cross-row spine drops within the same section.
      if (isSameSection && (isSameShelf || !isFiltered) && data.entryId !== entry.id) {
        // Same section reorder — handle here and stop propagation
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        const before = e.clientX < rect.left + rect.width / 2
        onDropOnSpine?.(data.entryId, entry.id, before)
      }
      // Cross-shelf or cross-section: bubble up to Shelf / SectionColumn
    } catch {
      // malformed drag data
    }
  }

  return (
    <div
      className={`book-spine group${isDragging ? ' dragging' : ''}`}
      style={{
        backgroundColor: color,
        height: `${height}px`,
        boxShadow: isSeriesHighlighted
          ? '0 0 0 2px #D4A55A, 0 0 8px rgba(212,165,90,0.5)'
          : undefined,
        borderLeft: dragOverSide === 'before' ? '3px solid #D4A55A' : undefined,
        borderRight: dragOverSide === 'after' ? '3px solid #D4A55A' : undefined,
        transition: isDragging
          ? 'opacity 80ms ease'
          : 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease',
      }}
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => {
        if (!isDragging) {
          setIsHovered(true)
          entry.series_name && onSeriesEnter?.(entry.series_name)
        }
      }}
      onMouseLeave={() => { setIsHovered(false); onSeriesLeave?.() }}
      title={`${title}${author ? ` — ${author}` : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`${title} by ${author}`}
    >
      {isCoverMode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.book.cover_url!}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'left center',
            display: 'block',
            // Prevent the image from intercepting drag events, which would
            // fire dragLeave on the parent spine and flicker the indicator.
            pointerEvents: 'none',
          }}
        />
      )}
      <span
        className="spine-title"
        style={{
          position: 'relative',
          zIndex: 1,
          textShadow: isCoverMode
            ? '0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)'
            : '0 1px 3px rgba(0,0,0,0.6)',
          // Same: prevent the span from swallowing drag events
          pointerEvents: 'none',
        }}
      >
        {title}
      </span>

      {isHovered && entry.series_name && (
        <div className="series-tooltip">{entry.series_name}</div>
      )}
    </div>
  )
}

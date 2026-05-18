"use client"
import { useState } from "react"
import { SectionWithEntries, ShelfEntry } from "@/lib/types"
import { chunkIntoShelves, computeBooksPerShelf } from "@/lib/utils"
import Shelf from "./Shelf"
import { Plus, Trash2, X } from "lucide-react"

interface SectionColumnProps {
  section: SectionWithEntries
  onBookClick: (entry: ShelfEntry) => void
  onAddBook: (sectionId: string, shelfIndex: number) => void
  onDeleteSection: (sectionId: string) => void
  onBookMoved: (entryId: string, fromSectionId: string, toSectionId: string) => void
  onReorderInSection: (sectionId: string, reorderedEntries: ShelfEntry[]) => void
  onMoveToShelf?: (sectionId: string, entryId: string, targetShelfIndex: number, newPosition: number) => void
  isFiltered?: boolean
  // Unfiltered mode: single shared width
  width?: number
  onWidthChange?: (width: number) => void
  // Filtered mode: per-bookcase widths
  bookcaseWidths?: number[]
  onBookcaseWidthChange?: (bookcaseIdx: number, newWidth: number) => void
  bookcaseCount?: number
  onDeleteBookcase?: () => void
}

export default function SectionColumn({
  section,
  onBookClick,
  onAddBook,
  onDeleteSection,
  onBookMoved,
  onReorderInSection,
  onMoveToShelf,
  isFiltered = false,
  width = 340,
  onWidthChange,
  bookcaseWidths,
  onBookcaseWidthChange,
  bookcaseCount = 1,
  onDeleteBookcase,
}: SectionColumnProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  const booksPerShelf = computeBooksPerShelf(width)

  // ── Resize handle (unfiltered mode only) ────────────────────────────────────
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width
    setIsResizing(true)
    const handleMouseMove = (ev: MouseEvent) => {
      onWidthChange?.(Math.max(240, Math.min(900, startWidth + ev.clientX - startX)))
    }
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // ── Per-bookcase resize handle (filtered mode) ──────────────────────────────
  const handleBookcaseResizeStart = (e: React.MouseEvent, bookcaseIdx: number, startWidth: number) => {
    e.preventDefault()
    const startX = e.clientX
    setIsResizing(true)
    const handleMouseMove = (ev: MouseEvent) => {
      onBookcaseWidthChange?.(bookcaseIdx, Math.max(240, Math.min(900, startWidth + ev.clientX - startX)))
    }
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // ── Cross-section drag-and-drop ─────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        entryId: string; fromSectionId: string
      }
      if (data.fromSectionId === section.id) return
      onBookMoved(data.entryId, data.fromSectionId, section.id)
    } catch { /* malformed */ }
  }

  // ── Within-bookcase reorder (filtered mode) ─────────────────────────────────
  // In filtered mode shelf_index === bookcaseIdx, so "same shelf" = same bookcase.
  const handleDropOnSpine = (draggedId: string, targetId: string, before: boolean) => {
    const entry = section.entries.find(e => e.id === draggedId)
    if (!entry) return
    const bookcaseIdx = entry.shelf_index ?? 0
    const bookcaseEntries = section.entries
      .filter(e => (e.shelf_index ?? 0) === bookcaseIdx)
      .sort((a, b) => a.position - b.position)
    const remaining = bookcaseEntries.filter(e => e.id !== draggedId)
    const targetIdx = remaining.findIndex(e => e.id === targetId)
    if (targetIdx === -1) return
    const insertAt = before ? targetIdx : targetIdx + 1
    const reordered = [
      ...remaining.slice(0, insertAt),
      entry,
      ...remaining.slice(insertAt),
    ]
    onReorderInSection(section.id, reordered)
  }

  // ── Cross-bookcase drop (filtered mode) ─────────────────────────────────────
  const handleDropOnShelf = (entryId: string, targetBookcaseIdx: number) => {
    const targetEntries = section.entries.filter(e => (e.shelf_index ?? 0) === targetBookcaseIdx)
    onMoveToShelf?.(section.id, entryId, targetBookcaseIdx, targetEntries.length)
  }

  // ── Shared section header ───────────────────────────────────────────────────
  const sectionHeader = (
    <div className="flex items-center justify-between px-4 py-3 mb-4">
      <div>
        <h2 className="text-[#D4A55A]" style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 600 }}>
          {section.name}
        </h2>
        <div style={{ height: '1px', width: '24px', background: '#D4A55A', marginTop: '3px', borderRadius: '1px', opacity: 0.7 }} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[#6B4020] mr-1">{section.entries.length} books</span>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={() => onDeleteSection(section.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 border border-red-500/40 rounded">Confirm</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-[#A08060] hover:text-[#F5E6C8] px-2 py-0.5">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="p-1 text-[#4A2C14] hover:text-[#A08060] transition-colors" title="Delete section">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )

  // ── Resize handle element (unfiltered only) ──────────────────────────────────
  const resizeHandle = (
    <div
      className="absolute top-0 right-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize group/resize z-20"
      onMouseDown={handleResizeStart}
      title="Drag to resize"
    >
      <div className="w-0.5 h-12 rounded-full transition-all duration-150 group-hover/resize:h-20 group-hover/resize:opacity-100 opacity-0"
        style={{ background: 'linear-gradient(to bottom, transparent, #D4A55A, transparent)' }}
      />
    </div>
  )

  // ── Column wrapper (unfiltered) ──────────────────────────────────────────────
  const columnStyle: React.CSSProperties = {
    width: `${width}px`,
    minWidth: '240px',
    outline: isDragOver ? '2px solid #D4A55A' : '2px solid transparent',
    outlineOffset: '4px',
    borderRadius: '8px',
    userSelect: isResizing ? 'none' : undefined,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ALL-SECTIONS MODE — flat reflow with DnD reorder
  // ══════════════════════════════════════════════════════════════════════════
  if (!isFiltered) {
    const rows = chunkIntoShelves(section.entries, booksPerShelf)
    const defaultAddShelf = section.entries.length > 0
      ? Math.max(...section.entries.map(e => e.shelf_index ?? 0))
      : 0

    return (
      <div
        className="flex flex-col relative"
        style={columnStyle}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {sectionHeader}

        <div className="flex flex-col gap-0 px-2 flex-1">
          {rows.map((rowBooks, i) => (
            <Shelf
              key={i}
              books={rowBooks}
              onBookClick={onBookClick}
              hoveredSeries={hoveredSeries}
              onSeriesEnter={s => setHoveredSeries(s)}
              onSeriesLeave={() => setHoveredSeries(null)}
              onDropOnSpine={handleDropOnSpine}
              // Use the first book's shelf_index as this row's identity.
              // In the new model shelf_index = bookcase, so all books in a
              // visual row share the same value and same-row reorders work
              // correctly with the existing handleDropOnSpine logic.
              shelfIndex={rowBooks[0]?.shelf_index ?? 0}
              sectionId={section.id}
              onDropOnShelf={handleDropOnShelf}
            />
          ))}
          {isDragOver && section.entries.length === 0 && (
            <div className="flex items-center justify-center h-32 border-2 border-dashed border-[#D4A55A]/40 rounded-lg text-[#D4A55A]/60 text-xs">
              Drop here
            </div>
          )}
        </div>

        <div className="mt-6 mx-4">
          <button
            onClick={() => onAddBook(section.id, defaultAddShelf)}
            className="flex items-center justify-center gap-2 py-2 px-5 rounded-full text-sm transition-all w-full"
            style={{ background: 'rgba(44,24,16,0.4)', border: '1px solid rgba(74,44,20,0.6)', color: '#A08060' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,32,16,0.6)'; e.currentTarget.style.borderColor = 'rgba(212,165,90,0.5)'; e.currentTarget.style.color = '#D4A55A' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(44,24,16,0.4)'; e.currentTarget.style.borderColor = 'rgba(74,44,20,0.6)'; e.currentTarget.style.color = '#A08060' }}
          >
            <Plus className="w-4 h-4" />
            Add a book
          </button>
        </div>

        {resizeHandle}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SINGLE-SECTION MODE — bookcase layout
  //
  // shelf_index on each entry = bookcase index (0, 1, 2 …).
  // Within a bookcase, entries are sorted by position.
  // Rows are computed dynamically: chunkIntoShelves(bookcaseBooks, booksPerShelf).
  // Always rendered as exactly 3 shelf planks per bookcase using CSS Grid so
  // row 0 of bookcase A aligns with row 0 of bookcase B, etc.
  // ══════════════════════════════════════════════════════════════════════════

  // Pre-compute each bookcase's data.
  // Each bookcase uses its own width so booksPerShelf (and thus reflow) is independent.
  const bookcases = Array.from({ length: bookcaseCount }, (_, bi) => {
    const bcWidth = bookcaseWidths?.[bi] ?? 340
    const bcBPS = computeBooksPerShelf(bcWidth)
    const books = section.entries
      .filter(e => (e.shelf_index ?? 0) === bi)
      .sort((a, b) => a.position - b.position)
    const rows = books.length === 0 ? [] : chunkIntoShelves(books, bcBPS)
    const isFull = books.length >= 3 * bcBPS
    return { books, rows, isFull, bcWidth }
  })

  // Each bookcase can have a different number of rows (different widths → different booksPerShelf).
  // maxRows keeps the empty plank slots rendered for visual consistency, but is per-bookcase now.

  // The last bookcase can be removed if it has no books and there is >1 bookcase.
  const lastIsEmpty =
    bookcaseCount > 1 &&
    (bookcases[bookcaseCount - 1]?.books.length ?? 0) === 0

  return (
    <div
      className="flex flex-col"
      style={{
        outline: isDragOver ? '2px solid #D4A55A' : '2px solid transparent',
        outlineOffset: '4px',
        borderRadius: '8px',
        userSelect: isResizing ? 'none' : undefined,
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {sectionHeader}

      {/*
        Flex row of independent bookcase wrappers.
        Each bookcase has its own width and its own resize handle on the right edge.
      */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '32px', padding: '0 8px', alignItems: 'flex-start' }}>
        {bookcases.map((bc, bi) => {
          const bcRows = Math.max(3, bc.rows.length)
          return (
            <div
              key={bi}
              style={{ position: 'relative', width: `${bc.bcWidth}px`, flexShrink: 0 }}
            >
              {Array.from({ length: bcRows }, (_, ri) => (
                <Shelf
                  key={ri}
                  books={bc.rows[ri] ?? []}
                  onBookClick={onBookClick}
                  hoveredSeries={hoveredSeries}
                  onSeriesEnter={s => setHoveredSeries(s)}
                  onSeriesLeave={() => setHoveredSeries(null)}
                  onDropOnSpine={handleDropOnSpine}
                  shelfIndex={bi}
                  sectionId={section.id}
                  onDropOnShelf={handleDropOnShelf}
                />
              ))}

              {/* Per-bookcase resize handle */}
              <div
                className="absolute top-0 right-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize group/resize z-20"
                onMouseDown={(e) => handleBookcaseResizeStart(e, bi, bc.bcWidth)}
                title="Drag to resize this bookcase"
              >
                <div
                  className="w-0.5 h-12 rounded-full transition-all duration-150 group-hover/resize:h-20 group-hover/resize:opacity-100 opacity-0"
                  style={{ background: 'linear-gradient(to bottom, transparent, #D4A55A, transparent)' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Per-bookcase action buttons — flex row aligned to each bookcase */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '32px', padding: '10px 8px 4px', alignItems: 'flex-start' }}>
        {bookcases.map((bc, bi) => (
          <div key={bi} className="flex flex-col gap-2" style={{ width: `${bc.bcWidth}px`, flexShrink: 0 }}>
            {/* Add a book */}
            <button
              onClick={() => !bc.isFull && onAddBook(section.id, bi)}
              disabled={bc.isFull}
              className="flex items-center justify-center gap-2 py-2 px-5 rounded-full text-sm transition-all w-full"
              style={{
                background: 'rgba(44,24,16,0.4)',
                border: '1px solid rgba(74,44,20,0.6)',
                color: bc.isFull ? 'rgba(107,64,32,0.4)' : '#A08060',
                cursor: bc.isFull ? 'not-allowed' : 'pointer',
                opacity: bc.isFull ? 0.45 : 1,
              }}
              onMouseEnter={e => {
                if (!bc.isFull) {
                  e.currentTarget.style.background = 'rgba(59,32,16,0.6)'
                  e.currentTarget.style.borderColor = 'rgba(212,165,90,0.5)'
                  e.currentTarget.style.color = '#D4A55A'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(44,24,16,0.4)'
                e.currentTarget.style.borderColor = 'rgba(74,44,20,0.6)'
                e.currentTarget.style.color = bc.isFull ? 'rgba(107,64,32,0.4)' : '#A08060'
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {bc.isFull ? 'Bookcase full' : 'Add a book'}
            </button>

            {/* Remove bookcase — only on the last empty one */}
            {bi === bookcaseCount - 1 && lastIsEmpty && (
              <button
                onClick={() => onDeleteBookcase?.()}
                className="flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-full text-xs transition-all w-full"
                style={{
                  background: 'rgba(59,14,14,0.3)',
                  border: '1px solid rgba(139,38,53,0.4)',
                  color: 'rgba(245,160,160,0.6)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(80,20,20,0.5)'
                  e.currentTarget.style.borderColor = 'rgba(139,38,53,0.7)'
                  e.currentTarget.style.color = '#F5A0A0'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(59,14,14,0.3)'
                  e.currentTarget.style.borderColor = 'rgba(139,38,53,0.4)'
                  e.currentTarget.style.color = 'rgba(245,160,160,0.6)'
                }}
              >
                <X className="w-3 h-3" />
                Remove bookcase
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

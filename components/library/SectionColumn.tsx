"use client"
import { useState } from "react"
import { SectionWithEntries, ShelfEntry } from "@/lib/types"
import { chunkIntoShelves } from "@/lib/utils"
import Shelf from "./Shelf"
import { Plus, Trash2 } from "lucide-react"

interface SectionColumnProps {
  section: SectionWithEntries
  onBookClick: (entry: ShelfEntry) => void
  onAddBook: (sectionId: string) => void
  onDeleteSection: (sectionId: string) => void
  onBookMoved: (entryId: string, fromSectionId: string, toSectionId: string) => void
  onReorderInSection: (sectionId: string, reorderedEntries: ShelfEntry[]) => void
}

export default function SectionColumn({
  section,
  onBookClick,
  onAddBook,
  onDeleteSection,
  onBookMoved,
  onReorderInSection,
}: SectionColumnProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null)
  const shelves = chunkIntoShelves(section.entries, 10)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        entryId: string
        fromSectionId: string
      }
      if (data.fromSectionId === section.id) return // same-section reorders are handled by BookSpine
      onBookMoved(data.entryId, data.fromSectionId, section.id)
    } catch {
      // malformed drag data
    }
  }

  const handleDropOnSpine = (draggedId: string, targetId: string, before: boolean) => {
    const entries = section.entries
    const draggedEntry = entries.find((e) => e.id === draggedId)
    if (!draggedEntry) return
    const remaining = entries.filter((e) => e.id !== draggedId)
    const targetIndex = remaining.findIndex((e) => e.id === targetId)
    if (targetIndex === -1) return
    const insertAt = before ? targetIndex : targetIndex + 1
    const reordered = [
      ...remaining.slice(0, insertAt),
      draggedEntry,
      ...remaining.slice(insertAt),
    ]
    onReorderInSection(section.id, reordered)
  }

  return (
    <div
      className="flex flex-col min-w-[340px] max-w-[380px] transition-all"
      style={{
        outline: isDragOver ? '2px solid #D4A55A' : '2px solid transparent',
        outlineOffset: '4px',
        borderRadius: '8px',
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 mb-4">
        <h2
          className="text-xl font-bold text-[#D4A55A] tracking-wide uppercase"
          style={{ fontFamily: 'var(--font-playfair)', letterSpacing: '0.12em' }}
        >
          {section.name}
        </h2>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#6B4020] mr-1">{section.entries.length} books</span>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDeleteSection(section.id)}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 border border-red-500/40 rounded"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-[#A08060] hover:text-[#F5E6C8] px-2 py-0.5"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 text-[#4A2C14] hover:text-[#A08060] transition-colors"
              title="Delete section"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Shelves */}
      <div className="flex flex-col gap-0 px-2 flex-1">
        {shelves.map((shelfBooks, i) => (
          <Shelf
            key={i}
            books={shelfBooks}
            onBookClick={onBookClick}
            hoveredSeries={hoveredSeries}
            onSeriesEnter={(series) => setHoveredSeries(series)}
            onSeriesLeave={() => setHoveredSeries(null)}
            onDropOnSpine={handleDropOnSpine}
          />
        ))}

        {isDragOver && section.entries.length === 0 && (
          <div className="flex items-center justify-center h-32 border-2 border-dashed border-[#D4A55A]/40 rounded-lg text-[#D4A55A]/60 text-xs">
            Drop here
          </div>
        )}
      </div>

      {/* Add book button */}
      <button
        onClick={() => onAddBook(section.id)}
        className="mt-6 mx-4 flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#4A2C14] hover:border-[#D4A55A] text-[#6B4020] hover:text-[#D4A55A] rounded-lg text-sm transition-colors group"
      >
        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
        Add a book
      </button>
    </div>
  )
}

"use client"
import { useState, useMemo } from "react"
import { X, BarChart2, ChevronLeft, ChevronRight, BookOpen } from "lucide-react"
import { ShelfEntry } from "@/lib/types"
import StarRating from "./StarRating"

interface StatsPanelProps {
  entries: ShelfEntry[]
  onClose: () => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export default function StatsPanel({ entries, onClose }: StatsPanelProps) {
  const now = new Date()
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-indexed

  // Earliest month we have read_at data for (to clamp navigation)
  const earliestDate = useMemo(() => {
    const readEntries = entries.filter(e => e.read_at)
    if (!readEntries.length) return new Date(now.getFullYear(), now.getMonth(), 1)
    return new Date(Math.min(...readEntries.map(e => new Date(e.read_at!).getTime())))
  }, [entries])

  const canGoPrev = viewYear > earliestDate.getFullYear() ||
    (viewYear === earliestDate.getFullYear() && viewMonth > earliestDate.getMonth())
  const canGoNext = viewYear < now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth < now.getMonth())

  const handlePrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const handleNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Books marked as read in the selected month
  const monthEntries = useMemo(() => {
    return entries
      .filter(e => {
        if (!e.read_at) return false
        const d = new Date(e.read_at)
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth
      })
      .sort((a, b) => new Date(b.read_at!).getTime() - new Date(a.read_at!).getTime())
  }, [entries, viewYear, viewMonth])

  // Monthly stats
  const booksRead  = monthEntries.length
  const pagesRead  = monthEntries.reduce((sum, e) => sum + (e.book.page_count ?? 150), 0)
  const ratedBooks = monthEntries.filter(e => e.user_rating != null)
  const avgRating  = ratedBooks.length
    ? ratedBooks.reduce((sum, e) => sum + e.user_rating!, 0) / ratedBooks.length
    : null

  // All-time stats (any entry with reading_status === 'read')
  const allTimeRead  = entries.filter(e => e.reading_status === 'read')
  const allTimePages = allTimeRead.reduce((sum, e) => sum + (e.book.page_count ?? 150), 0)

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-full sm:max-w-sm h-full flex flex-col overflow-hidden"
        style={{
          background: '#140A04',
          borderLeft: '1px solid rgba(74,44,20,0.5)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(74,44,20,0.4)' }}
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#D4A55A]" />
            <h2
              className="text-[#F5E6C8] font-semibold text-base"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Reading Stats
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#4A2C14] hover:text-[#A08060] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Month navigator */}
          <div
            className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(74,44,20,0.25)' }}
          >
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              className="p-1 text-[#6B4020] hover:text-[#D4A55A] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              className="text-sm font-semibold text-[#F5E6C8]"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className="p-1 text-[#6B4020] hover:text-[#D4A55A] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4">
            {/* Stat cards */}
            <div className="flex flex-col gap-2.5 mb-5">
              <StatCard
                emoji="📚"
                label="Books Read"
                value={String(booksRead)}
              />
              <StatCard
                emoji="⭐"
                label="Avg Rating"
                value={avgRating != null ? avgRating.toFixed(1) : '—'}
              />
              <StatCard
                emoji="📄"
                label="Pages Read"
                value={formatNumber(pagesRead)}
              />
            </div>

            {/* Book list for the month */}
            {monthEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <BookOpen className="w-9 h-9 mb-3" style={{ color: '#2C1810' }} />
                <p className="text-sm" style={{ color: '#4A2C14' }}>
                  No books marked as read
                </p>
                <p className="text-xs mt-1" style={{ color: '#2C1810' }}>
                  in {MONTH_NAMES[viewMonth]} {viewYear}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {monthEntries.map(entry => (
                  <BookRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>

          {/* All-time footer */}
          <div
            className="px-5 py-4 mt-2"
            style={{ borderTop: '1px solid rgba(74,44,20,0.25)' }}
          >
            <p className="text-[10px] uppercase tracking-wider text-[#4A2C14] mb-3">All time</p>
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-[#6B4020]">Books read</p>
                <p className="text-lg font-bold text-[#D4A55A]" style={{ fontFamily: 'var(--font-playfair)' }}>
                  {allTimeRead.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B4020]">Pages read</p>
                <p className="text-lg font-bold text-[#D4A55A]" style={{ fontFamily: 'var(--font-playfair)' }}>
                  {formatNumber(allTimePages)}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{
        background: 'rgba(44,24,16,0.45)',
        border: '1px solid rgba(74,44,20,0.3)',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-base">{emoji}</span>
        <span className="text-sm text-[#A08060]">{label}</span>
      </div>
      <span
        className="text-lg font-bold text-[#F5E6C8]"
        style={{ fontFamily: 'var(--font-playfair)' }}
      >
        {value}
      </span>
    </div>
  )
}

function BookRow({ entry }: { entry: ShelfEntry }) {
  const { book } = entry
  const displayTitle = entry.custom_title ?? book.title
  const pages = book.page_count ?? 150

  return (
    <div
      className="flex items-start gap-3 p-2.5 rounded-xl"
      style={{
        background: 'rgba(44,24,16,0.35)',
        border: '1px solid rgba(74,44,20,0.2)',
      }}
    >
      {book.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.cover_url}
          alt=""
          className="rounded flex-shrink-0"
          style={{ width: 28, height: 42, objectFit: 'cover' }}
        />
      ) : (
        <div
          className="rounded flex-shrink-0 flex items-center justify-center"
          style={{ width: 28, height: 42, background: 'rgba(59,31,14,0.6)' }}
        >
          <BookOpen className="w-3 h-3 text-[#3B1F0E]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#F5E6C8] leading-snug line-clamp-2">
          {displayTitle}
        </p>
        {book.authors[0] && (
          <p className="text-[10px] text-[#6B4020] truncate mt-0.5">{book.authors[0]}</p>
        )}
        <div className="flex items-center justify-between mt-1">
          {entry.user_rating != null
            ? <StarRating value={entry.user_rating} readOnly size={11} />
            : <span className="text-[10px] text-[#3B1F0E]">Unrated</span>
          }
          <span className="text-[10px] text-[#3B1F0E]">{formatNumber(pages)} pp</span>
        </div>
      </div>
    </div>
  )
}

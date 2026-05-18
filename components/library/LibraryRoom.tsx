"use client"
import { useState, useCallback, useMemo } from "react"
import { SectionWithEntries, ShelfEntry, Section, Book, Friendship, Recommendation } from "@/lib/types"
import SectionColumn from "./SectionColumn"
import BookDetailModal from "./BookDetailModal"
import AddBookModal from "./AddBookModal"
import CreateSectionModal from "./CreateSectionModal"
import FriendsPanel from "./FriendsPanel"
import { Plus, BookOpen, LogOut, Layers, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { deleteSection, moveBookToSection, moveToShelf, reorderSection, createRecommendation, removeRecommendation, addBookFromRecommendation } from "@/lib/mutations"
import { computeBooksPerShelf, generateSpineColor } from "@/lib/utils"

interface LibraryRoomProps {
  initialSections: SectionWithEntries[]
  userId: string
  initialFriendsRecs: Recommendation[]
  initialFriends: Friendship[]
  initialPendingRequests: Friendship[]
  initialMyRecs: Pick<Recommendation, 'id' | 'book_id'>[]
}

function sortEntries(entries: ShelfEntry[]): ShelfEntry[] {
  return [...entries].sort((a, b) => {
    const ai = a.shelf_index ?? 0, bi = b.shelf_index ?? 0
    if (ai !== bi) return ai - bi
    return a.position - b.position
  })
}

export default function LibraryRoom({
  initialSections,
  userId,
  initialFriendsRecs,
  initialFriends,
  initialPendingRequests,
  initialMyRecs,
}: LibraryRoomProps) {
  const router = useRouter()
  const [sections, setSections] = useState<SectionWithEntries[]>(initialSections)
  const [selectedEntry, setSelectedEntry] = useState<ShelfEntry | null>(null)
  const [addingToSection, setAddingToSection] = useState<string | null>(null)
  const [addingToShelf, setAddingToShelf] = useState(0)
  const [showCreateSection, setShowCreateSection] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [bookcaseCounts, setBookcaseCounts] = useState<Record<string, number>>({})
  // Per-bookcase widths for filtered (individual section) view.
  // Key = sectionId, value = array indexed by bookcase index.
  const [bookcaseWidths, setBookcaseWidths] = useState<Record<string, number[]>>({})
  // Independent display order for the unfiltered (all-sections) view.
  // Keyed by sectionId → ordered array of entry IDs.
  // Filtered-view reorders never touch this; only unfiltered-view DnD and
  // add/remove operations update it.
  // ── Social state ─────────────────────────────────────────────────────────────
  const [showFriendsPanel, setShowFriendsPanel] = useState(false)
  const [friends]        = useState<Friendship[]>(initialFriends)
  const [myRecs, setMyRecs] = useState<Pick<Recommendation, 'id' | 'book_id'>[]>(initialMyRecs)

  // Track the last time the Friends panel was opened so we can badge new recs.
  const recsLsKey = `shelfie_last_viewed_recs_${userId}`
  const [lastViewedRecsAt, setLastViewedRecsAt] = useState<Date>(() => {
    if (typeof window === 'undefined') return new Date(0)
    const stored = localStorage.getItem(`shelfie_last_viewed_recs_${userId}`)
    return stored ? new Date(stored) : new Date(0)
  })
  const hasNewRecs = initialFriendsRecs.some(
    r => new Date(r.created_at) > lastViewedRecsAt
  )

  const [unfilteredOrder, setUnfilteredOrder] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      initialSections.map(s => [
        s.id,
        sortEntries(s.entries).map(e => e.id),
      ])
    )
  )

  const handleSectionFilter = (id: string | null) => {
    setIsVisible(false)
    setTimeout(() => {
      setActiveSectionId(id)
      setIsVisible(true)
    }, 180)
  }

  // shelf_index in filtered mode = bookcase index (0, 1, 2 …).
  // Returns how many bookcases should be visible for a section.
  const getBookcaseCount = useCallback((sectionId: string, entries: { shelf_index: number }[]) => {
    const maxBookcaseIdx = entries.length > 0
      ? Math.max(...entries.map(e => e.shelf_index ?? 0))
      : 0
    const minFromEntries = maxBookcaseIdx + 1
    return Math.max(minFromEntries, bookcaseCounts[sectionId] ?? 1)
  }, [bookcaseCounts])

  const handleAddBookcase = useCallback(() => {
    if (!activeSectionId) return
    setSections(prev => prev) // no-op — just need the dependency
    setBookcaseCounts(prev => {
      const section = sections.find(s => s.id === activeSectionId)
      const current = section ? getBookcaseCount(activeSectionId, section.entries) : 1
      return { ...prev, [activeSectionId]: current + 1 }
    })
  }, [activeSectionId, sections, getBookcaseCount])

  const handleDeleteBookcase = useCallback(() => {
    if (!activeSectionId) return
    setBookcaseCounts(prev => {
      const section = sections.find(s => s.id === activeSectionId)
      const current = section ? getBookcaseCount(activeSectionId, section.entries) : 1
      return { ...prev, [activeSectionId]: Math.max(1, current - 1) }
    })
  }, [activeSectionId, sections, getBookcaseCount])

  const handleWidthChange = useCallback((sectionId: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [sectionId]: width }))
  }, [])

  const handleBookcaseWidthChange = useCallback((sectionId: string, bookcaseIdx: number, newWidth: number) => {
    // Always update the width immediately so the bookcase visually reflows.
    setBookcaseWidths((prev) => {
      const existing = prev[sectionId] ? [...prev[sectionId]] : []
      existing[bookcaseIdx] = newWidth
      return { ...prev, [sectionId]: existing }
    })

    // ── Overflow redistribution ─────────────────────────────────────────────
    // If narrowing caused more books than 3 planks can hold, push the excess
    // to the next bookcase(s) to the right, creating a new one if needed.
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const newBPS = computeBooksPerShelf(newWidth)
    const capacity = 3 * newBPS

    const bookcaseBooks = section.entries
      .filter(e => (e.shelf_index ?? 0) === bookcaseIdx)
      .sort((a, b) => a.position - b.position)

    if (bookcaseBooks.length <= capacity) return // no overflow — nothing to do

    // Build a mutable per-bookcase array so we can redistribute in memory.
    const currentCount = getBookcaseCount(sectionId, section.entries)

    // Width helper: use newWidth for the resized bookcase, stored widths for others.
    const getWidth = (bi: number) =>
      bi === bookcaseIdx ? newWidth : (bookcaseWidths[sectionId]?.[bi] ?? 340)

    const bcArrays: ShelfEntry[][] = Array.from({ length: currentCount }, (_, bi) =>
      section.entries
        .filter(e => (e.shelf_index ?? 0) === bi)
        .sort((a, b) => a.position - b.position)
    )

    // Trim the resized bookcase; the excess becomes the overflow to redistribute.
    const overflow = bcArrays[bookcaseIdx].splice(capacity)
    let remaining = overflow       // same reference — we'll splice from it
    let neededCount = currentCount

    for (let ti = bookcaseIdx + 1; remaining.length > 0; ti++) {
      if (ti >= neededCount) {
        // No more existing bookcases — create a fresh one.
        bcArrays.push([])
        neededCount++
      }
      const tiBPS = computeBooksPerShelf(getWidth(ti))
      const tiCapacity = 3 * tiBPS
      const tiAvailable = tiCapacity - (bcArrays[ti]?.length ?? 0)
      if (tiAvailable > 0) {
        const toMove = remaining.splice(0, tiAvailable)
        bcArrays[ti] = [...(bcArrays[ti] ?? []), ...toMove]
      }
      // If this target is full (tiAvailable <= 0), the loop advances to ti+1.
    }

    // Compute which entries actually moved (new shelf_index or position).
    const movedEntries: Array<{ id: string; shelf_index: number; position: number }> = []
    const updatedEntries = section.entries.map(e => {
      for (let bi = 0; bi < bcArrays.length; bi++) {
        const pos = bcArrays[bi].findIndex(be => be.id === e.id)
        if (pos !== -1) {
          if ((e.shelf_index ?? 0) !== bi || e.position !== pos) {
            movedEntries.push({ id: e.id, shelf_index: bi, position: pos })
            return { ...e, shelf_index: bi, position: pos }
          }
          return e
        }
      }
      return e
    })

    setSections(prev =>
      prev.map(s => s.id === sectionId ? { ...s, entries: sortEntries(updatedEntries) } : s)
    )

    if (neededCount > currentCount) {
      setBookcaseCounts(prev => ({
        ...prev,
        [sectionId]: Math.max(prev[sectionId] ?? 1, neededCount),
      }))
    }

    // Persist each moved book to the DB.
    movedEntries.forEach(({ id, shelf_index, position }) => {
      moveToShelf(id, shelf_index, position).catch(console.error)
    })
  }, [sections, bookcaseWidths, getBookcaseCount])

  const handleAddBook = useCallback((sectionId: string, shelfIndex: number) => {
    setAddingToSection(sectionId)
    setAddingToShelf(shelfIndex)
  }, [])

  // In unfiltered mode, compute display entries from unfilteredOrder (independent
  // of filtered-view bookcase placement).  Virtual shelf_index / position values
  // are assigned so that existing DnD logic in SectionColumn/BookSpine/Shelf
  // keeps working correctly (same-row detection, etc.).
  const displayedSections = useMemo(() => {
    const base = activeSectionId
      ? sections.filter(s => s.id === activeSectionId)
      : sections

    if (activeSectionId) return base   // filtered mode — use raw entries as-is

    return base.map(section => {
      const order = unfilteredOrder[section.id]
      if (!order) return section
      const bps = computeBooksPerShelf(columnWidths[section.id] ?? 340)
      const entries = order
        .map(id => section.entries.find(e => e.id === id))
        .filter((e): e is ShelfEntry => e !== undefined)
        .map((e, i) => ({
          ...e,
          shelf_index: Math.floor(i / bps),  // virtual row for DnD
          position:    i % bps,
        }))
      return { ...section, entries }
    })
  }, [activeSectionId, sections, unfilteredOrder, columnWidths])

  const handleRecommendToggle = useCallback(async (entry: ShelfEntry) => {
    const existing = myRecs.find(r => r.book_id === entry.book_id)
    if (existing) {
      setMyRecs(prev => prev.filter(r => r.id !== existing.id))
      try {
        await removeRecommendation(existing.id)
      } catch (e) {
        setMyRecs(prev => [...prev, existing])
        console.error('Remove recommendation failed', e)
      }
    } else {
      try {
        const rec = await createRecommendation(userId, entry.book_id, entry.user_rating)
        setMyRecs(prev => [...prev, rec])
      } catch (e) {
        console.error('Create recommendation failed', e)
      }
    }
  }, [myRecs, userId])

  const handleAddFromRec = useCallback(async (book: Book, sectionId: string) => {
    const section = sections.find(s => s.id === sectionId)
    const count = section?.entries.length ?? 0
    const spineColor = generateSpineColor(book.google_books_id)
    // Throws DuplicateBookError on conflict — let the caller (RecCard) handle it
    const entry = await addBookFromRecommendation(book.id, sectionId, userId, count, spineColor)
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, entries: sortEntries([...s.entries, entry]) } : s
    ))
    setUnfilteredOrder(prev => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] ?? []), entry.id],
    }))
  }, [sections, userId])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleBookClick = useCallback((entry: ShelfEntry) => {
    setSelectedEntry(entry)
  }, [])

  const handleBookAdded = useCallback((sectionId: string, newEntry: ShelfEntry) => {
    setSections((prev) => {
      const updated = prev.map((s) =>
        s.id === sectionId
          ? { ...s, entries: sortEntries([...s.entries, newEntry]) }
          : s
      )
      // Auto-add a new bookcase if the bookcase the book landed in is now full.
      // shelf_index on the entry IS the bookcase index in filtered mode.
      const section = updated.find(s => s.id === sectionId)
      if (section) {
        const bookcaseIdx = newEntry.shelf_index ?? 0
        // In filtered mode each bookcase has its own width; fall back to section width or default.
        const w = bookcaseWidths[sectionId]?.[bookcaseIdx]
          ?? columnWidths[sectionId]
          ?? 340
        const bps = computeBooksPerShelf(w)
        const bookcaseBookCount = section.entries.filter(e => (e.shelf_index ?? 0) === bookcaseIdx).length
        if (bookcaseBookCount >= 3 * bps) {
          setBookcaseCounts(prev => ({
            ...prev,
            [sectionId]: Math.max(prev[sectionId] ?? 1, bookcaseIdx + 2),
          }))
        }
      }
      return updated
    })
    // Append new book at the end of the unfiltered display order.
    setUnfilteredOrder(prev => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] ?? []), newEntry.id],
    }))
    setAddingToSection(null)
  }, [columnWidths])

  const handleRatingChange = useCallback((entryId: string, rating: number) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        entries: s.entries.map((e) =>
          e.id === entryId ? { ...e, user_rating: rating } : e
        ),
      }))
    )
    setSelectedEntry((prev) =>
      prev?.id === entryId ? { ...prev, user_rating: rating } : prev
    )
  }, [])

  const handleBookRemoved = useCallback((entryId: string) => {
    // Remove from unfiltered order (search all sections).
    setUnfilteredOrder(prev => {
      const updated = { ...prev }
      for (const sid of Object.keys(updated)) {
        if (updated[sid].includes(entryId)) {
          updated[sid] = updated[sid].filter(id => id !== entryId)
          break
        }
      }
      return updated
    })
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        entries: s.entries.filter((e) => e.id !== entryId),
      }))
    )
    setSelectedEntry(null)
  }, [])

  const handleSectionCreated = useCallback((section: Section) => {
    setSections((prev) => [...prev, { ...section, entries: [] }])
    setShowCreateSection(false)
  }, [])

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    try {
      await deleteSection(sectionId)
      setSections((prev) => prev.filter((s) => s.id !== sectionId))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleEntryUpdated = useCallback(
    (entryId: string, spineColor: string, customTitle: string | null, seriesName: string | null, readingStatus: string) => {
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          entries: s.entries.map((e) =>
            e.id === entryId ? { ...e, spine_color: spineColor, custom_title: customTitle, series_name: seriesName, reading_status: readingStatus as ShelfEntry['reading_status'] } : e
          ),
        }))
      )
      setSelectedEntry((prev) =>
        prev?.id === entryId ? { ...prev, spine_color: spineColor, custom_title: customTitle, series_name: seriesName, reading_status: readingStatus as ShelfEntry['reading_status'] } : prev
      )
    },
    []
  )

  const handleReorderInSection = useCallback(
    async (sectionId: string, reorderedEntries: ShelfEntry[]) => {
      if (!activeSectionId) {
        // ── Unfiltered view reorder ──────────────────────────────────────────
        // Only update the in-memory display order; never touch DB positions or
        // shelf_index (those belong to the filtered-view bookcase layout).
        const reorderedIds = reorderedEntries.map(e => e.id)
        const reorderedSet = new Set(reorderedIds)
        setUnfilteredOrder(prev => {
          const cur = prev[sectionId] ?? []
          // Find where this group sits in the current order
          const firstIdx = cur.findIndex(id => reorderedSet.has(id))
          const without   = cur.filter(id => !reorderedSet.has(id))
          const insertAt  = firstIdx >= 0 ? firstIdx : without.length
          return {
            ...prev,
            [sectionId]: [
              ...without.slice(0, insertAt),
              ...reorderedIds,
              ...without.slice(insertAt),
            ],
          }
        })
        return
      }

      // ── Filtered view reorder ────────────────────────────────────────────
      // Update real shelf_index/position in sections state and persist to DB.
      // unfilteredOrder is intentionally NOT touched here.
      const shelfIdx = reorderedEntries[0]?.shelf_index ?? 0
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s
          const otherEntries = s.entries.filter((e) => (e.shelf_index ?? 0) !== shelfIdx)
          const withPositions = reorderedEntries.map((e, i) => ({ ...e, position: i }))
          return { ...s, entries: sortEntries([...otherEntries, ...withPositions]) }
        })
      )
      try {
        await reorderSection(reorderedEntries.map((e, i) => ({ id: e.id, position: i })))
      } catch (e) {
        console.error('Reorder failed', e)
      }
    },
    [activeSectionId]
  )

  const handleMoveToShelf = useCallback(
    async (sectionId: string, entryId: string, targetShelfIndex: number, newPosition: number) => {
      if (!activeSectionId) {
        // ── Unfiltered view cross-row drop ───────────────────────────────────
        // targetShelfIndex is a virtual row index; only update display order.
        const bps = computeBooksPerShelf(columnWidths[sectionId] ?? 340)
        setUnfilteredOrder(prev => {
          const cur    = prev[sectionId] ?? []
          const without = cur.filter(id => id !== entryId)
          // Insert at the logical position within the target row
          const insertAt = Math.min(targetShelfIndex * bps + newPosition, without.length)
          return {
            ...prev,
            [sectionId]: [
              ...without.slice(0, insertAt),
              entryId,
              ...without.slice(insertAt),
            ],
          }
        })
        return
      }

      // ── Filtered view cross-bookcase drop ────────────────────────────────
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s
          const updated = s.entries.map((e) =>
            e.id === entryId ? { ...e, shelf_index: targetShelfIndex, position: newPosition } : e
          )
          return { ...s, entries: sortEntries(updated) }
        })
      )
      try {
        await moveToShelf(entryId, targetShelfIndex, newPosition)
      } catch (e) {
        console.error('Move to shelf failed', e)
      }
    },
    [activeSectionId, columnWidths]
  )

  const handleBookMoved = useCallback(
    async (entryId: string, fromSectionId: string, toSectionId: string) => {
      // Move in unfiltered order: remove from source section, append to dest.
      setUnfilteredOrder(prev => ({
        ...prev,
        [fromSectionId]: (prev[fromSectionId] ?? []).filter(id => id !== entryId),
        [toSectionId]:   [...(prev[toSectionId] ?? []), entryId],
      }))

      let movedEntry: ShelfEntry | undefined
      setSections((prev) => {
        const fromSection = prev.find((s) => s.id === fromSectionId)
        movedEntry = fromSection?.entries.find((e) => e.id === entryId)
        if (!movedEntry) return prev
        const toSection = prev.find((s) => s.id === toSectionId)
        const newPosition = toSection ? toSection.entries.length : 0
        return prev.map((s) => {
          if (s.id === fromSectionId) return { ...s, entries: s.entries.filter((e) => e.id !== entryId) }
          if (s.id === toSectionId) return { ...s, entries: [...s.entries, { ...movedEntry!, section_id: toSectionId, position: newPosition, shelf_index: 0 }] }
          return s
        })
      })
      try {
        const toSection = sections.find((s) => s.id === toSectionId)
        const newPosition = toSection ? toSection.entries.length : 0
        await moveBookToSection(entryId, toSectionId, newPosition)
      } catch (e) {
        console.error('Move failed, reverting', e)
        // Revert unfiltered order too
        setUnfilteredOrder(prev => ({
          ...prev,
          [fromSectionId]: [...(prev[fromSectionId] ?? []), entryId],
          [toSectionId]:   (prev[toSectionId] ?? []).filter(id => id !== entryId),
        }))
        setSections((prev) => {
          if (!movedEntry) return prev
          return prev.map((s) => {
            if (s.id === fromSectionId) return { ...s, entries: [...s.entries, { ...movedEntry!, section_id: fromSectionId }] }
            if (s.id === toSectionId) return { ...s, entries: s.entries.filter((e) => e.id !== entryId) }
            return s
          })
        })
      }
    },
    [sections]
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0E0804 0%, #1C1008 30%, #150D06 100%)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-4 flex-shrink-0 sticky top-0 z-30"
        style={{
          background: 'rgba(14,8,4,0.72)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          borderBottom: '1px solid rgba(74,44,20,0.5)',
        }}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-[#D4A55A]" />
          <h1 className="text-3xl font-bold text-[#D4A55A]" style={{ fontFamily: 'var(--font-playfair)' }}>
            Shelfie
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={activeSectionId ?? ''}
            onChange={(e) => handleSectionFilter(e.target.value || null)}
            style={{
              background: 'rgba(44,24,16,0.7)',
              border: '1px solid rgba(74,44,20,0.7)',
              color: activeSectionId ? '#D4A55A' : '#A08060',
              borderRadius: '8px',
              padding: '6px 28px 6px 12px',
              fontSize: '13px',
              fontFamily: 'var(--font-playfair)',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23A08060'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
            }}
          >
            <option value="" style={{ background: '#1C0E06' }}>All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id} style={{ background: '#1C0E06' }}>{s.name}</option>
            ))}
          </select>

          {activeSectionId ? (
            <button
              onClick={handleAddBookcase}
              className="flex items-center gap-2 px-4 py-2 bg-[#2C1810] hover:bg-[#3B2010] border border-[#4A2C14] hover:border-[#D4A55A] text-[#D4A55A] rounded-lg text-sm transition-colors"
            >
              <Layers className="w-4 h-4" />
              Add Bookcase
            </button>
          ) : (
            <button
              onClick={() => setShowCreateSection(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2C1810] hover:bg-[#3B2010] border border-[#4A2C14] hover:border-[#D4A55A] text-[#D4A55A] rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Section
            </button>
          )}
          {/* Friends panel toggle */}
          <button
            onClick={() => {
              const opening = !showFriendsPanel
              setShowFriendsPanel(opening)
              if (opening) {
                // Mark all current recs as seen the moment the panel opens
                const now = new Date()
                setLastViewedRecsAt(now)
                try { localStorage.setItem(recsLsKey, now.toISOString()) } catch { /* ignore */ }
              }
            }}
            className="relative p-2 transition-colors"
            style={{ color: showFriendsPanel ? '#D4A55A' : '#6B4020' }}
            onMouseEnter={e => { if (!showFriendsPanel) e.currentTarget.style.color = '#A08060' }}
            onMouseLeave={e => { if (!showFriendsPanel) e.currentTarget.style.color = '#6B4020' }}
            title="Friends & Recommendations"
          >
            <Users className="w-4 h-4" />
            {(initialPendingRequests.length > 0 || hasNewRecs) && !showFriendsPanel && (
              <span
                className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full text-white text-[8px] flex items-center justify-center font-bold"
                style={{ background: '#8B2635' }}
              >
                {initialPendingRequests.length > 0 ? initialPendingRequests.length : '!'}
              </span>
            )}
          </button>

          <button
            onClick={handleSignOut}
            className="p-2 text-[#6B4020] hover:text-[#A08060] transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Library room */}
      <div className="flex-1 overflow-x-auto library-scroll">
        <div
          className="flex gap-8 p-8 pb-16"
          style={{
            minWidth: 'max-content',
            minHeight: 'calc(100vh - 72px)',
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 180ms ease',
          }}
        >
          {displayedSections.length === 0 ? (
            <div className="flex items-center justify-center w-full text-center">
              <div className="text-[#4A2C14]">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="text-[#6B4020] text-lg">Your library is empty.</p>
                <p className="text-[#4A2C14] text-sm mt-1">Create a section to get started.</p>
              </div>
            </div>
          ) : (
            displayedSections.map((section) => (
              <div
                key={section.id}
                className="relative"
                style={{
                  background: 'linear-gradient(180deg, rgba(28,16,8,0) 0%, rgba(15,8,3,0.4) 100%)',
                  borderLeft: '1px solid rgba(74,44,20,0.3)',
                  paddingLeft: '12px',
                }}
              >
                <SectionColumn
                  section={section}
                  onBookClick={handleBookClick}
                  onAddBook={handleAddBook}
                  onDeleteSection={handleDeleteSection}
                  onBookMoved={handleBookMoved}
                  onReorderInSection={handleReorderInSection}
                  onMoveToShelf={handleMoveToShelf}
                  isFiltered={!!activeSectionId}
                  width={columnWidths[section.id] ?? 340}
                  onWidthChange={(w) => handleWidthChange(section.id, w)}
                  bookcaseWidths={
                    activeSectionId
                      ? Array.from(
                          { length: getBookcaseCount(section.id, section.entries) },
                          (_, i) => bookcaseWidths[section.id]?.[i] ?? 340
                        )
                      : undefined
                  }
                  onBookcaseWidthChange={
                    activeSectionId
                      ? (bi, w) => handleBookcaseWidthChange(section.id, bi, w)
                      : undefined
                  }
                  bookcaseCount={getBookcaseCount(section.id, section.entries)}
                  onDeleteBookcase={activeSectionId ? handleDeleteBookcase : undefined}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Friends panel */}
      {showFriendsPanel && (
        <FriendsPanel
          userId={userId}
          initialRecs={initialFriendsRecs}
          initialFriends={initialFriends}
          initialPending={initialPendingRequests}
          sections={sections}
          onAddToLibrary={handleAddFromRec}
          onClose={() => setShowFriendsPanel(false)}
        />
      )}

      {/* Modals */}
      {selectedEntry && (
        <BookDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onRatingChange={handleRatingChange}
          onRemove={handleBookRemoved}
          onEntryUpdated={handleEntryUpdated}
          hasFriends={friends.length > 0}
          isRecommended={myRecs.some(r => r.book_id === selectedEntry.book_id)}
          onRecommendToggle={() => handleRecommendToggle(selectedEntry)}
        />
      )}

      {addingToSection && (
        <AddBookModal
          sectionId={addingToSection}
          userId={userId}
          targetShelfIndex={addingToShelf}
          currentCount={
            // addingToShelf = bookcaseIdx in filtered mode, so count all books
            // in that bookcase to use as position for the new entry.
            sections.find((s) => s.id === addingToSection)
              ?.entries.filter((e) => (e.shelf_index ?? 0) === addingToShelf).length ?? 0
          }
          onClose={() => setAddingToSection(null)}
          onBookAdded={handleBookAdded}
        />
      )}

      {showCreateSection && (
        <CreateSectionModal
          userId={userId}
          displayOrder={sections.length}
          onClose={() => setShowCreateSection(false)}
          onCreated={handleSectionCreated}
        />
      )}
    </div>
  )
}

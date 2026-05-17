"use client"
import { useState, useCallback } from "react"
import { SectionWithEntries, ShelfEntry, Section } from "@/lib/types"
import SectionColumn from "./SectionColumn"
import BookDetailModal from "./BookDetailModal"
import AddBookModal from "./AddBookModal"
import CreateSectionModal from "./CreateSectionModal"
import { Plus, BookOpen, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { deleteSection, moveBookToSection, reorderSection } from "@/lib/mutations"

interface LibraryRoomProps {
  initialSections: SectionWithEntries[]
  userId: string
}

export default function LibraryRoom({ initialSections, userId }: LibraryRoomProps) {
  const router = useRouter()
  const [sections, setSections] = useState<SectionWithEntries[]>(initialSections)
  const [selectedEntry, setSelectedEntry] = useState<ShelfEntry | null>(null)
  const [addingToSection, setAddingToSection] = useState<string | null>(null)
  const [showCreateSection, setShowCreateSection] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleBookClick = useCallback((entry: ShelfEntry) => {
    setSelectedEntry(entry)
  }, [])

  const handleBookAdded = useCallback((sectionId: string, newEntry: ShelfEntry) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, entries: [...s.entries, newEntry] }
          : s
      )
    )
    setAddingToSection(null)
  }, [])

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
    (entryId: string, spineColor: string, customTitle: string | null, seriesName: string | null) => {
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          entries: s.entries.map((e) =>
            e.id === entryId ? { ...e, spine_color: spineColor, custom_title: customTitle, series_name: seriesName } : e
          ),
        }))
      )
      setSelectedEntry((prev) =>
        prev?.id === entryId ? { ...prev, spine_color: spineColor, custom_title: customTitle, series_name: seriesName } : prev
      )
    },
    []
  )

  const handleReorderInSection = useCallback(
    async (sectionId: string, reorderedEntries: ShelfEntry[]) => {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, entries: reorderedEntries } : s))
      )
      try {
        await reorderSection(reorderedEntries.map((e, i) => ({ id: e.id, position: i })))
      } catch (e) {
        console.error('Reorder failed', e)
      }
    },
    []
  )

  const handleBookMoved = useCallback(
    async (entryId: string, fromSectionId: string, toSectionId: string) => {
      // Find the entry being moved
      let movedEntry: ShelfEntry | undefined
      setSections((prev) => {
        const fromSection = prev.find((s) => s.id === fromSectionId)
        movedEntry = fromSection?.entries.find((e) => e.id === entryId)
        if (!movedEntry) return prev
        const toSection = prev.find((s) => s.id === toSectionId)
        const newPosition = toSection ? toSection.entries.length : 0
        return prev.map((s) => {
          if (s.id === fromSectionId) return { ...s, entries: s.entries.filter((e) => e.id !== entryId) }
          if (s.id === toSectionId) return { ...s, entries: [...s.entries, { ...movedEntry!, section_id: toSectionId, position: newPosition }] }
          return s
        })
      })
      // Persist — find newPosition from updated state
      try {
        const toSection = sections.find((s) => s.id === toSectionId)
        const newPosition = toSection ? toSection.entries.length : 0
        await moveBookToSection(entryId, toSectionId, newPosition)
      } catch (e) {
        console.error('Move failed, reverting', e)
        // Revert: put it back in the original section
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
      <header className="flex items-center justify-between px-8 py-4 border-b border-[#2C1810] flex-shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-[#D4A55A]" />
          <h1 className="text-3xl font-bold text-[#D4A55A]" style={{ fontFamily: 'var(--font-playfair)' }}>
            Shelfie
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateSection(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2C1810] hover:bg-[#3B2010] border border-[#4A2C14] hover:border-[#D4A55A] text-[#D4A55A] rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Section
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

      {/* Library room — horizontal scroll */}
      <div className="flex-1 overflow-x-auto library-scroll">
        <div
          className="flex gap-8 p-8 pb-16"
          style={{ minWidth: 'max-content', minHeight: 'calc(100vh - 72px)' }}
        >
          {/* Wall texture overlay on top of each column area */}
          {sections.length === 0 ? (
            <div className="flex items-center justify-center w-full text-center">
              <div className="text-[#4A2C14]">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="text-[#6B4020] text-lg">Your library is empty.</p>
                <p className="text-[#4A2C14] text-sm mt-1">Create a section to get started.</p>
              </div>
            </div>
          ) : (
            sections.map((section) => (
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
                  onAddBook={setAddingToSection}
                  onDeleteSection={handleDeleteSection}
                  onBookMoved={handleBookMoved}
                  onReorderInSection={handleReorderInSection}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedEntry && (
        <BookDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onRatingChange={handleRatingChange}
          onRemove={handleBookRemoved}
          onEntryUpdated={handleEntryUpdated}
        />
      )}

      {addingToSection && (
        <AddBookModal
          sectionId={addingToSection}
          userId={userId}
          currentCount={sections.find((s) => s.id === addingToSection)?.entries.length ?? 0}
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

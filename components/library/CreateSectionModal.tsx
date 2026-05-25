"use client"
import { useState, useRef, useEffect } from "react"
import { Section } from "@/lib/types"
import { createSection } from "@/lib/mutations"
import { X, BookMarked } from "lucide-react"

interface CreateSectionModalProps {
  userId: string
  displayOrder: number
  onClose: () => void
  onCreated: (section: Section) => void
}

export default function CreateSectionModal({
  userId,
  displayOrder,
  onClose,
  onCreated,
}: CreateSectionModalProps) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please enter a section name.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const section = await createSection(userId, name.trim(), displayOrder)
      onCreated(section)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create section")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-panel w-full max-w-[95vw] sm:max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: '#1C0E06', border: '1px solid #4A2C14' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#D4A55A]" />
            <h3 className="text-lg font-bold text-[#F5E6C8]" style={{ fontFamily: 'var(--font-playfair)' }}>
              New Section
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#6B4020] hover:text-[#A08060]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-sm text-[#A08060] block mb-1.5">Section name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g. Science Fiction, Classics..."
            className="w-full bg-[#0E0804] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#4A2C14] focus:outline-none focus:border-[#D4A55A] transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-[#4A2C14] text-[#6B4020] hover:text-[#A08060] hover:border-[#6B4020] rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 py-2.5 bg-[#D4A55A] hover:bg-[#C49040] disabled:opacity-50 text-[#1C1008] font-semibold rounded-lg text-sm transition-colors"
          >
            {loading ? "Creating..." : "Create Section"}
          </button>
        </div>
      </div>
    </div>
  )
}

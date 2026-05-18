"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { GoogleBookResult, ShelfEntry } from "@/lib/types"
import { addBookToSection, DuplicateBookError } from "@/lib/mutations"
import { SPINE_PALETTE, generateSpineColor } from "@/lib/utils"
import { Search, X, BookOpen, Loader2, Check } from "lucide-react"
import Image from "next/image"

interface AddBookModalProps {
  sectionId: string
  userId: string
  currentCount: number
  targetShelfIndex?: number
  onClose: () => void
  onBookAdded: (sectionId: string, entry: ShelfEntry) => void
}

export default function AddBookModal({
  sectionId,
  userId,
  currentCount,
  targetShelfIndex = 0,
  onClose,
  onBookAdded,
}: AddBookModalProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GoogleBookResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")

  // Spine picker state
  const [pendingBook, setPendingBook] = useState<GoogleBookResult | null>(null)
  const [selectedSpine, setSelectedSpine] = useState<string>("")
  const [seriesName, setSeriesName] = useState("")

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(""), 4000)
  }

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`)
      setResults(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  const openPicker = (book: GoogleBookResult) => {
    setPendingBook(book)
    setSelectedSpine(book.thumbnail ? 'cover' : generateSpineColor(book.id))
    setSeriesName("")
  }

  const handleConfirmAdd = async () => {
    if (!pendingBook) return
    setAdding(true)
    setError("")
    try {
      const entry = await addBookToSection(
        pendingBook,
        sectionId,
        userId,
        currentCount,
        selectedSpine,
        seriesName.trim() || null,
        targetShelfIndex
      )
      onBookAdded(sectionId, entry)
    } catch (e) {
      if (e instanceof DuplicateBookError) {
        showToast("This book is already on this shelf")
        setPendingBook(null)
      } else {
        setError(e instanceof Error ? e.message : "Failed to add book")
      }
      setAdding(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Duplicate toast */}
      {toast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium"
          style={{ background: '#3B1010', border: '1px solid #8B2635', color: '#F5A0A0' }}
        >
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            className="text-[#F5A0A0]/60 hover:text-[#F5A0A0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        className="modal-panel w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: '#1C0E06', border: '1px solid #4A2C14', maxHeight: '85vh' }}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2C1810] flex-shrink-0">
          <Search className="w-4 h-4 text-[#6B4020] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search for a book..."
            className="flex-1 bg-transparent text-[#F5E6C8] placeholder-[#4A2C14] focus:outline-none text-sm"
          />
          {loading && <Loader2 className="w-4 h-4 text-[#D4A55A] animate-spin flex-shrink-0" />}
          <button onClick={onClose} className="p-1 text-[#6B4020] hover:text-[#A08060]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="px-5 py-2 bg-red-900/30 text-red-400 text-xs border-b border-[#2C1810] flex-shrink-0">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {results.length === 0 && !loading && query.length > 1 && (
            <div className="flex flex-col items-center justify-center py-12 text-[#4A2C14]">
              <BookOpen className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No books found for &ldquo;{query}&rdquo;</p>
            </div>
          )}
          {results.length === 0 && !loading && query.length < 2 && (
            <div className="flex flex-col items-center justify-center py-12 text-[#4A2C14]">
              <Search className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Type to search millions of books</p>
            </div>
          )}

          {results.map((book) => (
            <div key={book.id}>
              {/* Result row */}
              <div
                className={`flex items-start gap-3 px-5 py-3 border-b border-[#1C0E06] transition-colors ${
                  pendingBook?.id === book.id ? 'bg-[#2C1810]' : 'hover:bg-[#241208]'
                }`}
              >
                <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-[#2C1810]">
                  {book.thumbnail ? (
                    <Image src={book.thumbnail} alt={book.title} width={40} height={56} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-[#4A2C14]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#F5E6C8] truncate">{book.title}</p>
                  <p className="text-xs text-[#A08060] truncate">{book.authors.join(", ") || "Unknown Author"}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[#6B4020]">
                    {book.publishedYear && <span>{book.publishedYear}</span>}
                    {book.averageRating && <span>★ {book.averageRating.toFixed(1)}</span>}
                  </div>
                </div>

                <button
                  onClick={() => pendingBook?.id === book.id ? setPendingBook(null) : openPicker(book)}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    pendingBook?.id === book.id
                      ? 'bg-[#4A2C14] text-[#D4A55A] hover:bg-[#5A3A1A]'
                      : 'bg-[#D4A55A] hover:bg-[#C49040] text-[#1C1008]'
                  }`}
                >
                  {pendingBook?.id === book.id ? 'Cancel' : 'Select'}
                </button>
              </div>

              {/* Inline spine picker — only for the pending book */}
              {pendingBook?.id === book.id && (
                <div className="px-5 py-4 bg-[#150B04] border-b border-[#2C1810]">
                  <p className="text-xs text-[#A08060] mb-3 font-medium uppercase tracking-wider">Choose spine style</p>

                  <div className="flex items-end gap-4">
                    {/* Spine preview */}
                    <div className="flex-shrink-0">
                      <p className="text-xs text-[#4A2C14] mb-1.5 text-center">Preview</p>
                      <div
                        style={{
                          width: '30px',
                          height: '100px',
                          borderRadius: '2px 2px 0 0',
                          border: '1px solid rgba(0,0,0,0.3)',
                          backgroundColor: selectedSpine === 'cover' ? '#1C0E06' : selectedSpine,
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selectedSpine === 'cover' && book.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={book.thumbnail}
                            alt=""
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              objectPosition: 'left center',
                            }}
                          />
                        )}
                        <span
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            fontSize: '6px',
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.9)',
                            textShadow: selectedSpine === 'cover'
                              ? '0 1px 4px rgba(0,0,0,0.95)'
                              : '0 1px 3px rgba(0,0,0,0.6)',
                            overflow: 'hidden',
                            maxWidth: '80%',
                            whiteSpace: 'nowrap',
                            padding: '3px 2px',
                          }}
                        >
                          {book.title}
                        </span>
                      </div>
                    </div>

                    {/* Options */}
                    <div className="flex-1">
                      {/* Cover option */}
                      {book.thumbnail && (
                        <div className="mb-3">
                          <p className="text-xs text-[#6B4020] mb-1.5">Cover crop</p>
                          <button
                            onClick={() => setSelectedSpine('cover')}
                            className={`relative w-8 h-12 rounded overflow-hidden border-2 transition-all ${
                              selectedSpine === 'cover' ? 'border-[#D4A55A] scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                          >
                            <Image src={book.thumbnail} alt="Cover" width={32} height={48} className="w-full h-full object-cover" style={{ objectPosition: 'left center' }} unoptimized />
                            {selectedSpine === 'cover' && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Colour swatches */}
                      <div>
                        <p className="text-xs text-[#6B4020] mb-1.5">Colour</p>
                        <div className="flex flex-wrap gap-1.5">
                          {SPINE_PALETTE.map((color, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedSpine(color)}
                              className={`w-6 h-6 rounded-sm border-2 transition-all ${
                                selectedSpine === color ? 'border-[#F5E6C8] scale-125' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-110'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Series name input */}
                  <div className="mt-4">
                    <label className="text-xs text-[#A08060] block mb-1.5 uppercase tracking-wider">
                      Series <span className="text-[#4A2C14] normal-case tracking-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={seriesName}
                      onChange={(e) => setSeriesName(e.target.value)}
                      placeholder="e.g. The Stormlight Archive"
                      className="w-full bg-[#0E0804] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-3 py-2 text-sm placeholder-[#4A2C14] focus:outline-none focus:border-[#D4A55A] transition-colors"
                    />
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handleConfirmAdd}
                    disabled={adding}
                    className="mt-4 w-full py-2.5 bg-[#D4A55A] hover:bg-[#C49040] disabled:opacity-50 text-[#1C1008] font-semibold rounded-lg text-sm transition-colors"
                  >
                    {adding ? "Adding to shelf..." : "Add to Shelf"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

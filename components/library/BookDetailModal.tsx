"use client"
import { useState } from "react"
import { ShelfEntry, Friendship } from "@/lib/types"
import StarRating from "./StarRating"
import { updateRating, removeBookFromShelf, updateShelfEntry } from "@/lib/mutations"
import { SPINE_PALETTE, generateSpineColor, READING_STATUSES, ReadingStatus } from "@/lib/utils"
import { X, Trash2, BookOpen, Pencil, Check, Heart, ChevronDown, ChevronUp, Minus } from "lucide-react"
import Image from "next/image"

interface BookDetailModalProps {
  entry: ShelfEntry
  onClose: () => void
  onRatingChange: (entryId: string, rating: number) => void
  onRemove: (entryId: string) => void
  onEntryUpdated: (entryId: string, spineColor: string, customTitle: string | null, seriesName: string | null, readingStatus: string) => void
  // Social
  friends?: Friendship[]
  userId?: string
  recommendedToFriendIds?: string[]
  onFriendRecommendToggle?: (friendId: string, recommend: boolean) => Promise<void>
}

export default function BookDetailModal({
  entry,
  onClose,
  onRatingChange,
  onRemove,
  onEntryUpdated,
  friends,
  userId,
  recommendedToFriendIds = [],
  onFriendRecommendToggle,
}: BookDetailModalProps) {
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Friend-picker state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())
  const [nicknames] = useState<Record<string, string>>(() => {
    if (!userId) return {}
    try {
      const stored = localStorage.getItem(`shelfie_friend_nicknames_${userId}`)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  const hasFriends = (friends?.length ?? 0) > 0
  const anyRecommended = recommendedToFriendIds.length > 0
  const allRecommended = hasFriends && friends!.every(f => recommendedToFriendIds.includes(f.profile.id))
  const someRecommended = anyRecommended && !allRecommended

  const friendDisplayName = (f: Friendship) =>
    nicknames[f.profile.id] ?? f.profile.display_name ?? f.profile.email

  // currentIsRec is passed explicitly to avoid reading stale closure state
  const handleToggleFriend = async (friendId: string, currentIsRec: boolean) => {
    if (togglingIds.has(friendId) || !onFriendRecommendToggle) return
    setTogglingIds(prev => new Set(prev).add(friendId))
    setErrorIds(prev => { const n = new Set(prev); n.delete(friendId); return n })
    try {
      await onFriendRecommendToggle(friendId, !currentIsRec)
    } catch {
      setErrorIds(prev => new Set(prev).add(friendId))
    } finally {
      setTogglingIds(prev => { const n = new Set(prev); n.delete(friendId); return n })
    }
  }

  const handleToggleAll = async () => {
    if (!friends || !onFriendRecommendToggle) return
    if (allRecommended) {
      // Remove all — concurrent is fine, each targets a different DB row
      await Promise.all(friends.map(f => handleToggleFriend(f.profile.id, true)))
    } else {
      // Add sequentially so each insert commits before the next starts,
      // preventing any race with the unique constraint or React state
      for (const f of friends) {
        if (!recommendedToFriendIds.includes(f.profile.id)) {
          await handleToggleFriend(f.profile.id, false)
        }
      }
    }
  }

  // Edit mode state — initialised from current entry
  const [editSpine, setEditSpine] = useState(entry.spine_color ?? generateSpineColor(entry.book.google_books_id))
  const [editTitle, setEditTitle] = useState(entry.custom_title ?? entry.book.title)
  const [editSeries, setEditSeries] = useState(entry.series_name ?? "")
  const [editStatus, setEditStatus] = useState<ReadingStatus>((entry.reading_status as ReadingStatus) ?? 'want_to_read')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState("")

  const { book } = entry
  const coverUrl = book.cover_url_large ?? book.cover_url
  const displayTitle = entry.custom_title ?? book.title

  const isCoverPreview = editSpine === 'cover' && !!book.cover_url

  const handleRate = async (rating: number) => {
    setSaving(true)
    try {
      await updateRating(entry.id, rating)
      onRatingChange(entry.id, rating)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await removeBookFromShelf(entry.id)
      onRemove(entry.id)
    } finally {
      setRemoving(false)
    }
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    setEditError("")
    try {
      const customTitle = editTitle.trim() === book.title ? null : editTitle.trim() || null
      const seriesName = editSeries.trim() || null
      await updateShelfEntry(entry.id, editSpine, customTitle, seriesName, editStatus)
      onEntryUpdated(entry.id, editSpine, customTitle, seriesName, editStatus)
      setIsEditing(false)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCancelEdit = () => {
    setEditSpine(entry.spine_color ?? generateSpineColor(entry.book.google_books_id))
    setEditTitle(entry.custom_title ?? book.title)
    setEditSeries(entry.series_name ?? "")
    setEditStatus((entry.reading_status as ReadingStatus) ?? 'want_to_read')
    setEditError("")
    setIsEditing(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-panel relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#1C0E06', border: '1px solid #4A2C14' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-[#A08060] hover:text-[#F5E6C8] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── View mode ─────────────────────────────── */}
        {!isEditing && (
          <div className="flex">
            {/* Cover panel */}
            <div
              className="w-36 flex-shrink-0 flex items-center justify-center"
              style={{ background: entry.spine_color === 'cover' ? '#1C0E06' : (entry.spine_color ?? '#3B1F0E'), minHeight: '260px' }}
            >
              {coverUrl ? (
                <Image src={coverUrl} alt={book.title} width={144} height={220} className="w-full h-full object-cover" unoptimized />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <BookOpen className="w-10 h-10 text-white/40 mb-2" />
                  <span className="text-white/60 text-xs">{displayTitle}</span>
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="flex-1 p-6 flex flex-col">
              <h2 className="text-xl font-bold text-[#F5E6C8] leading-tight mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>
                {displayTitle}
              </h2>
              {entry.custom_title && (
                <p className="text-xs text-[#6B4020] mb-1 italic">Original: {book.title}</p>
              )}
              {book.authors.length > 0 && (
                <p className="text-[#D4A55A] text-sm mb-1">{book.authors.join(", ")}</p>
              )}
              {entry.series_name && (
                <p className="text-xs text-[#A08060] mb-2 italic">{entry.series_name}</p>
              )}
              {(() => {
                const s = READING_STATUSES.find(x => x.value === (entry.reading_status ?? 'want_to_read'))
                return s ? (
                  <span
                    className="inline-block mb-3 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}` }}
                  >
                    {s.label}
                  </span>
                ) : null
              })()}
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B4020] mb-4">
                {book.published_year && <span>{book.published_year}</span>}
                {book.page_count && <span>{book.page_count} pages</span>}
                {book.average_rating && <span className="text-[#A08060]">★ {book.average_rating.toFixed(1)} on Google</span>}
              </div>
              {book.description && (
                <p className="text-[#A08060] text-xs leading-relaxed mb-4 line-clamp-4 flex-1">
                  {book.description}
                </p>
              )}
              <div className="mt-auto">
                <p className="text-xs text-[#6B4020] mb-2">{saving ? "Saving..." : "Your rating"}</p>
                <StarRating value={entry.user_rating} onChange={handleRate} />

                {hasFriends && (
                  <div className="mt-3">
                    {/* Header row toggles the picker open/closed */}
                    <button
                      onClick={() => setPickerOpen(v => !v)}
                      className="flex items-center gap-1.5 text-xs transition-colors w-full"
                      style={{ color: anyRecommended ? '#D4A55A' : '#4A2C14' }}
                      onMouseEnter={e => { if (!anyRecommended) e.currentTarget.style.color = '#A08060' }}
                      onMouseLeave={e => { if (!anyRecommended) e.currentTarget.style.color = anyRecommended ? '#D4A55A' : '#4A2C14' }}
                    >
                      <Heart className="w-3.5 h-3.5 flex-shrink-0" fill={anyRecommended ? '#D4A55A' : 'none'} />
                      <span className="flex-1 text-left">
                        {anyRecommended
                          ? `Recommended to ${recommendedToFriendIds.length} friend${recommendedToFriendIds.length > 1 ? 's' : ''}`
                          : 'Recommend to friends'}
                      </span>
                      {pickerOpen ? <ChevronUp className="w-3 h-3 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
                    </button>

                    {pickerOpen && (
                      <div
                        className="mt-2 rounded-lg overflow-hidden"
                        style={{ border: '1px solid rgba(74,44,20,0.4)', background: 'rgba(14,8,4,0.6)' }}
                      >
                        {/* All friends row */}
                        <button
                          onClick={handleToggleAll}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                          style={{ borderBottom: '1px solid rgba(74,44,20,0.3)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(44,24,16,0.5)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0"
                            style={{
                              background: allRecommended ? '#D4A55A' : 'transparent',
                              borderColor: anyRecommended ? '#D4A55A' : 'rgba(74,44,20,0.7)',
                            }}
                          >
                            {allRecommended && <Check className="w-2.5 h-2.5 text-[#1C0E06]" />}
                            {someRecommended && <Minus className="w-2.5 h-2.5 text-[#D4A55A]" />}
                          </div>
                          <span className="text-xs font-medium" style={{ color: anyRecommended ? '#D4A55A' : '#6B4020' }}>
                            All friends
                          </span>
                        </button>

                        {/* Individual friends */}
                        <div className="max-h-36 overflow-y-auto">
                          {friends!.map(f => {
                            const isRec = recommendedToFriendIds.includes(f.profile.id)
                            const isLoading = togglingIds.has(f.profile.id)
                            const hasError = errorIds.has(f.profile.id)
                            return (
                              <button
                                key={f.id}
                                onClick={() => handleToggleFriend(f.profile.id, isRec)}
                                disabled={isLoading}
                                className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors disabled:opacity-50"
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(44,24,16,0.5)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                              >
                                <div
                                  className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors"
                                  style={{
                                    background: isRec ? '#D4A55A' : 'transparent',
                                    borderColor: hasError ? '#ef4444' : isRec ? '#D4A55A' : 'rgba(74,44,20,0.7)',
                                  }}
                                >
                                  {isRec && <Check className="w-2.5 h-2.5 text-[#1C0E06]" />}
                                </div>
                                <span className="text-xs truncate" style={{ color: hasError ? '#ef4444' : isRec ? '#D4A55A' : '#A08060' }}>
                                  {friendDisplayName(f)}
                                </span>
                                {isLoading && (
                                  <span className="ml-auto text-[10px] text-[#4A2C14] flex-shrink-0">…</span>
                                )}
                                {hasError && !isLoading && (
                                  <span className="ml-auto text-[9px] text-red-400 flex-shrink-0">failed</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Edit mode ─────────────────────────────── */}
        {isEditing && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-[#F5E6C8] mb-5" style={{ fontFamily: 'var(--font-playfair)' }}>
              Edit Spine
            </h3>

            {/* Title override */}
            <div className="mb-5">
              <label className="text-xs text-[#A08060] block mb-1.5 uppercase tracking-wider">Spine title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-[#0E0804] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#4A2C14] focus:outline-none focus:border-[#D4A55A] transition-colors"
                placeholder={book.title}
              />
              {editTitle !== book.title && editTitle.trim() !== '' && (
                <button
                  onClick={() => setEditTitle(book.title)}
                  className="text-xs text-[#6B4020] hover:text-[#A08060] mt-1"
                >
                  Reset to original
                </button>
              )}
            </div>

            {/* Series name */}
            <div className="mb-5">
              <label className="text-xs text-[#A08060] block mb-1.5 uppercase tracking-wider">
                Series <span className="text-[#4A2C14] normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={editSeries}
                onChange={(e) => setEditSeries(e.target.value)}
                placeholder="e.g. The Stormlight Archive"
                className="w-full bg-[#0E0804] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#4A2C14] focus:outline-none focus:border-[#D4A55A] transition-colors"
              />
            </div>

            {/* Reading status */}
            <div className="mb-5">
              <label className="text-xs text-[#A08060] block mb-2 uppercase tracking-wider">Status</label>
              <div className="flex gap-2 flex-wrap">
                {READING_STATUSES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setEditStatus(s.value)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: editStatus === s.value ? s.bg : 'transparent',
                      color: editStatus === s.value ? s.color : '#4A2C14',
                      border: `1px solid ${editStatus === s.value ? s.color : 'rgba(74,44,20,0.4)'}`,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spine style picker */}
            <div className="mb-5">
              <label className="text-xs text-[#A08060] block mb-3 uppercase tracking-wider">Spine style</label>
              <div className="flex items-end gap-5">
                {/* Live preview */}
                <div className="flex-shrink-0">
                  <p className="text-xs text-[#4A2C14] mb-1.5 text-center">Preview</p>
                  <div
                    style={{
                      width: '30px',
                      height: '100px',
                      borderRadius: '2px 2px 0 0',
                      border: '1px solid rgba(0,0,0,0.3)',
                      backgroundColor: isCoverPreview ? '#1C0E06' : editSpine,
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isCoverPreview && book.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.cover_url}
                        alt=""
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left center' }}
                      />
                    )}
                    <span
                      style={{
                        position: 'relative', zIndex: 1,
                        writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                        fontSize: '6px', fontWeight: 700,
                        color: 'rgba(255,255,255,0.9)',
                        textShadow: isCoverPreview ? '0 1px 4px rgba(0,0,0,0.95)' : '0 1px 3px rgba(0,0,0,0.6)',
                        overflow: 'hidden', maxWidth: '80%', whiteSpace: 'nowrap', padding: '3px 2px',
                      }}
                    >
                      {editTitle || book.title}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  {/* Cover option */}
                  {book.cover_url && (
                    <div className="mb-3">
                      <p className="text-xs text-[#6B4020] mb-1.5">Cover crop</p>
                      <button
                        onClick={() => setEditSpine('cover')}
                        className={`relative w-8 h-12 rounded overflow-hidden border-2 transition-all ${
                          editSpine === 'cover' ? 'border-[#D4A55A] scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <Image src={book.cover_url} alt="Cover" width={32} height={48} className="w-full h-full object-cover" style={{ objectPosition: 'left center' }} unoptimized />
                        {editSpine === 'cover' && (
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
                          onClick={() => setEditSpine(color)}
                          className={`w-6 h-6 rounded-sm border-2 transition-all ${
                            editSpine === color ? 'border-[#F5E6C8] scale-125' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-110'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {editError && <p className="text-xs text-red-400 mb-3">{editError}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleCancelEdit}
                className="flex-1 py-2.5 border border-[#4A2C14] text-[#6B4020] hover:text-[#A08060] hover:border-[#6B4020] rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 py-2.5 bg-[#D4A55A] hover:bg-[#C49040] disabled:opacity-50 text-[#1C1008] font-semibold rounded-lg text-sm transition-colors"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#2C1810]">
          <span className="text-xs text-[#4A2C14]">
            Added {new Date(entry.date_added).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <div className="flex items-center gap-3">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-xs text-[#6B4020] hover:text-[#A08060] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center gap-1.5 text-xs text-red-500/60 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {removing ? "Removing..." : "Remove from shelf"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

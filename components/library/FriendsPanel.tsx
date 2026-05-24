"use client"
import { useState, useEffect, useRef } from "react"
import { X, Users, Search, UserPlus, Check, BookOpen, UserMinus, BookPlus, Pencil, Send, MessageSquare, ArrowLeft, UserPlus2 } from "lucide-react"
import { Friendship, Recommendation, Profile, Section, Book, ShelfEntry, Forum, ForumMember, ForumMessage } from "@/lib/types"
import StarRating from "./StarRating"
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  removeRecommendation,
  DuplicateBookError,
} from "@/lib/mutations"

interface FriendsPanelProps {
  userId: string
  initialRecs: Recommendation[]
  initialFriends: Friendship[]
  initialPending: Friendship[]
  sections: Section[]
  onAddToLibrary: (book: Book, sectionId: string) => Promise<void>
  onClose: () => void
  myRecs: Pick<Recommendation, 'id' | 'book_id' | 'recipient_id'>[]
  allEntries: ShelfEntry[]
  onRemoveMyRec: (recId: string) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function FriendsPanel({
  userId,
  initialRecs,
  initialFriends,
  initialPending,
  sections,
  onAddToLibrary,
  onClose,
  myRecs,
  allEntries,
  onRemoveMyRec,
}: FriendsPanelProps) {
  const [tab, setTab] = useState<'feed' | 'sent' | 'forums' | 'friends'>('feed')
  const [recs]                       = useState<Recommendation[]>(initialRecs)
  const [friends, setFriends]        = useState<Friendship[]>(initialFriends)
  const [pending, setPending]        = useState<Friendship[]>(initialPending)

  // Search state
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching]         = useState(false)
  const [sentRequests, setSentRequests]   = useState<Set<string>>(new Set())

  // Nicknames (localStorage, client-only mount)
  const nicknameLsKey = `shelfie_friend_nicknames_${userId}`
  const [nicknames, setNicknames] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(`shelfie_friend_nicknames_${userId}`)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [nicknameInput, setNicknameInput] = useState('')

  const [unsendingIds, setUnsendingIds] = useState<Set<string>>(new Set())

  // ── Forums state ───────────────────────────────────────────────────────────
  const [forums, setForums]               = useState<Forum[]>([])
  const [loadingForums, setLoadingForums] = useState(false)
  const [activeForum, setActiveForum]     = useState<Forum | null>(null)
  const [messages, setMessages]           = useState<ForumMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageInput, setMessageInput]   = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [closingForum, setClosingForum]   = useState(false)
  const [leavingForum, setLeavingForum]   = useState(false)
  const [showInvite, setShowInvite]       = useState(false)
  const [invitingIds, setInvitingIds]     = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Debounced user search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) setSearchResults(await res.json())
      } catch { /* ignore */ }
      finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reload forum list each time the Forums tab is opened
  useEffect(() => {
    if (tab !== 'forums') return
    setLoadingForums(true)
    fetch('/api/forums')
      .then(r => r.json())
      .then((data: Forum[]) => setForums(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingForums(false))
  }, [tab])

  // Poll messages while a forum is open
  useEffect(() => {
    if (!activeForum) return
    let mounted = true
    const load = () =>
      fetch(`/api/forums/${activeForum.id}/messages`)
        .then(r => r.json())
        .then((data: ForumMessage[]) => { if (mounted) setMessages(Array.isArray(data) ? data : []) })
        .catch(() => {})
    setLoadingMessages(true)
    load().finally(() => { if (mounted) setLoadingMessages(false) })
    const interval = setInterval(load, 3000)
    return () => { mounted = false; clearInterval(interval) }
  }, [activeForum])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Friend actions ─────────────────────────────────────────────────────────

  const handleSendRequest = async (toUserId: string) => {
    try {
      await sendFriendRequest(userId, toUserId)
      setSentRequests(prev => new Set(prev).add(toUserId))
    } catch (e) { console.error(e) }
  }

  const handleAccept = async (friendship: Friendship) => {
    try {
      await acceptFriendRequest(friendship.id)
      setPending(prev => prev.filter(f => f.id !== friendship.id))
      setFriends(prev => [...prev, { ...friendship, status: 'accepted' }])
    } catch (e) { console.error(e) }
  }

  const handleDecline = async (friendshipId: string) => {
    try {
      await declineFriendRequest(friendshipId)
      setPending(prev => prev.filter(f => f.id !== friendshipId))
    } catch (e) { console.error(e) }
  }

  const handleRemoveFriend = async (friendshipId: string) => {
    try {
      await removeFriend(friendshipId)
      setFriends(prev => prev.filter(f => f.id !== friendshipId))
    } catch (e) { console.error(e) }
  }

  const saveNickname = (friendUserId: string) => {
    const trimmed = nicknameInput.trim()
    setNicknames(prev => {
      const updated = { ...prev }
      if (trimmed) updated[friendUserId] = trimmed
      else delete updated[friendUserId]
      try { localStorage.setItem(nicknameLsKey, JSON.stringify(updated)) } catch { /* ignore */ }
      return updated
    })
    setEditingUserId(null)
  }

  const handleUnsend = async (recId: string) => {
    if (unsendingIds.has(recId)) return
    setUnsendingIds(prev => new Set(prev).add(recId))
    try {
      await removeRecommendation(recId)
      onRemoveMyRec(recId)
    } catch (e) { console.error('Unsend failed', e) }
    finally { setUnsendingIds(prev => { const n = new Set(prev); n.delete(recId); return n }) }
  }

  // ── Forum actions ──────────────────────────────────────────────────────────

  const openForum = (forum: Forum) => {
    setActiveForum(forum)
    setShowInvite(false)
    setMessages([])
  }

  const closeForum = () => {
    setActiveForum(null)
    setMessages([])
    setShowInvite(false)
  }

  const handleSendMessage = async () => {
    if (!activeForum || !messageInput.trim() || sendingMessage) return
    setSendingMessage(true)
    const content = messageInput.trim()
    setMessageInput('')
    try {
      const res = await fetch(`/api/forums/${activeForum.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const msg: ForumMessage = await res.json()
        setMessages(prev => [...prev, msg])
        setForums(prev => prev.map(f =>
          f.id === activeForum.id ? { ...f, last_message_at: msg.created_at } : f
        ))
      }
    } catch { /* ignore */ }
    finally { setSendingMessage(false) }
  }

  const handleCloseForum = async () => {
    if (!activeForum || closingForum) return
    setClosingForum(true)
    try {
      const res = await fetch(`/api/forums/${activeForum.id}`, { method: 'PATCH' })
      if (res.ok) { setForums(prev => prev.filter(f => f.id !== activeForum.id)); closeForum() }
    } catch { /* ignore */ }
    finally { setClosingForum(false) }
  }

  const handleLeaveForum = async () => {
    if (!activeForum || leavingForum) return
    setLeavingForum(true)
    try {
      const res = await fetch(`/api/forums/${activeForum.id}/leave`, { method: 'POST' })
      if (res.ok) { setForums(prev => prev.filter(f => f.id !== activeForum.id)); closeForum() }
    } catch { /* ignore */ }
    finally { setLeavingForum(false) }
  }

  const handleInviteFriend = async (friendId: string) => {
    if (!activeForum || invitingIds.has(friendId)) return
    setInvitingIds(prev => new Set(prev).add(friendId))
    try {
      const res = await fetch(`/api/forums/${activeForum.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: friendId }),
      })
      if (res.ok) {
        const newMember: ForumMember = await res.json()
        const updated = { ...activeForum, members: [...activeForum.members, newMember] }
        setActiveForum(updated)
        setForums(prev => prev.map(f => f.id === activeForum.id ? updated : f))
      }
    } catch { /* ignore */ }
    finally { setInvitingIds(prev => { const n = new Set(prev); n.delete(friendId); return n }) }
  }

  const nonMemberFriends = activeForum
    ? friends.filter(f => !activeForum.members.some(m => m.user_id === f.profile.id))
    : []

  const friendName = (uid: string) => {
    const f = friends.find(fr => fr.profile.id === uid)
    return nicknames[uid] ?? f?.profile.display_name ?? f?.profile.email ?? uid
  }

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
        className="relative w-full max-w-sm h-full flex flex-col overflow-hidden"
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
            <Users className="w-4 h-4 text-[#D4A55A]" />
            <h2 className="text-[#F5E6C8] font-semibold text-base" style={{ fontFamily: 'var(--font-playfair)' }}>
              Friends
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#4A2C14] hover:text-[#A08060] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(74,44,20,0.4)' }}>
          {(['feed', 'sent', 'forums', 'friends'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t !== 'forums') closeForum() }}
              className={`flex-1 py-2.5 text-xs relative transition-colors ${
                tab === t ? 'text-[#D4A55A]' : 'text-[#4A2C14] hover:text-[#6B4020]'
              }`}
            >
              {t === 'friends' && pending.length > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                  style={{ background: '#8B2635' }}
                >
                  {pending.length}
                </span>
              )}
              {t === 'feed' ? 'Rec Feed' : t === 'sent' ? 'My Recs' : t === 'forums' ? 'Forums' : 'Friends'}
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4A55A]" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* ── Rec Feed tab ──────────────────────────────────────────── */}
          {tab === 'feed' && (
            <div className="p-4 flex flex-col gap-3">
              {recs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-center">
                  <BookOpen className="w-10 h-10 mb-3" style={{ color: '#2C1810' }} />
                  <p className="text-sm" style={{ color: '#4A2C14' }}>No recommendations yet</p>
                  <p className="text-xs mt-1" style={{ color: '#2C1810' }}>Add friends and their recs will appear here</p>
                </div>
              ) : recs.map(rec => (
                <RecCard key={rec.id} rec={rec} sections={sections} onAddToLibrary={onAddToLibrary} nicknames={nicknames} />
              ))}
            </div>
          )}

          {/* ── My Recs tab ───────────────────────────────────────────── */}
          {tab === 'sent' && (
            <div className="p-4 flex flex-col gap-3">
              {myRecs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-center">
                  <Send className="w-10 h-10 mb-3" style={{ color: '#2C1810' }} />
                  <p className="text-sm" style={{ color: '#4A2C14' }}>No recommendations sent yet</p>
                  <p className="text-xs mt-1" style={{ color: '#2C1810' }}>Click a book and recommend it to a friend</p>
                </div>
              ) : (() => {
                const grouped = new Map<string, Pick<Recommendation, 'id' | 'book_id' | 'recipient_id'>[]>()
                for (const rec of myRecs) {
                  if (!grouped.has(rec.book_id)) grouped.set(rec.book_id, [])
                  grouped.get(rec.book_id)!.push(rec)
                }
                return Array.from(grouped.entries()).map(([bookId, bookRecs]) => {
                  const entry = allEntries.find(e => e.book_id === bookId)
                  const book = entry?.book
                  return (
                    <div key={bookId} className="p-3 rounded-xl" style={{ background: 'rgba(44,24,16,0.45)', border: '1px solid rgba(74,44,20,0.3)' }}>
                      <div className="flex items-start gap-3 mb-2.5">
                        {book?.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={book.cover_url} alt="" className="rounded flex-shrink-0" style={{ width: 32, height: 48, objectFit: 'cover' }} />
                        ) : (
                          <div className="rounded flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 48, background: 'rgba(59,31,14,0.6)' }}>
                            <BookOpen className="w-3 h-3 text-[#3B1F0E]" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#F5E6C8] leading-snug line-clamp-2">{book?.title ?? 'Unknown book'}</p>
                          {book?.authors?.[0] && <p className="text-xs text-[#6B4020] truncate mt-0.5">{book.authors[0]}</p>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 pt-2" style={{ borderTop: '1px solid rgba(74,44,20,0.25)' }}>
                        {bookRecs.map(rec => {
                          const name = friendName(rec.recipient_id)
                          return (
                            <div key={rec.id} className="flex items-center justify-between">
                              <p className="text-xs text-[#A08060]"><span className="text-[#4A2C14] mr-1">→</span>{name}</p>
                              <button
                                onClick={() => handleUnsend(rec.id)}
                                disabled={unsendingIds.has(rec.id)}
                                className="p-1 text-[#4A2C14] hover:text-red-400 transition-colors disabled:opacity-40"
                                title="Unsend"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* ── Forums tab — list view ─────────────────────────────────── */}
          {tab === 'forums' && !activeForum && (
            <div className="p-4 flex flex-col gap-3">
              {loadingForums ? (
                <p className="text-xs text-center text-[#4A2C14] mt-8">Loading…</p>
              ) : forums.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-center">
                  <MessageSquare className="w-10 h-10 mb-3" style={{ color: '#2C1810' }} />
                  <p className="text-sm" style={{ color: '#4A2C14' }}>No active forums</p>
                  <p className="text-xs mt-1" style={{ color: '#2C1810' }}>Click a book and hit &ldquo;Start forum&rdquo; to begin</p>
                </div>
              ) : forums.map(forum => {
                const memberNames = forum.members
                  .map(m => nicknames[m.user_id] ?? m.profile?.display_name ?? m.profile?.email ?? '?')
                  .join(', ')
                return (
                  <button
                    key={forum.id}
                    onClick={() => openForum(forum)}
                    className="p-3 rounded-xl text-left w-full transition-colors"
                    style={{ background: 'rgba(44,24,16,0.45)', border: '1px solid rgba(74,44,20,0.3)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,165,90,0.4)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(74,44,20,0.3)' }}
                  >
                    <div className="flex items-start gap-3">
                      {forum.book.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={forum.book.cover_url} alt="" className="rounded flex-shrink-0" style={{ width: 28, height: 42, objectFit: 'cover' }} />
                      ) : (
                        <div className="rounded flex-shrink-0 flex items-center justify-center" style={{ width: 28, height: 42, background: 'rgba(59,31,14,0.6)' }}>
                          <BookOpen className="w-3 h-3 text-[#3B1F0E]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#F5E6C8] truncate">{forum.book.title}</p>
                        <p className="text-[10px] text-[#6B4020] truncate mt-0.5">{memberNames}</p>
                        <p className="text-[10px] text-[#3B1F0E] mt-1">{timeAgo(forum.last_message_at)}</p>
                      </div>
                      <MessageSquare className="w-3.5 h-3.5 text-[#4A2C14] flex-shrink-0 mt-0.5" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Forums tab — detail view ───────────────────────────────── */}
          {tab === 'forums' && activeForum && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Forum header */}
              <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(74,44,20,0.3)' }}>
                <button onClick={closeForum} className="p-1 text-[#4A2C14] hover:text-[#A08060] transition-colors flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#F5E6C8] truncate">{activeForum.book.title}</p>
                  <p className="text-[10px] text-[#6B4020] truncate">
                    {activeForum.members.map(m => nicknames[m.user_id] ?? m.profile?.display_name ?? m.profile?.email ?? '?').join(', ')}
                  </p>
                </div>
                {activeForum.created_by === userId && (
                  <button
                    onClick={() => setShowInvite(v => !v)}
                    className="p-1 text-[#4A2C14] hover:text-[#D4A55A] transition-colors flex-shrink-0"
                    title="Invite friend"
                  >
                    <UserPlus2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {activeForum.created_by === userId ? (
                  <button
                    onClick={handleCloseForum}
                    disabled={closingForum}
                    className="text-[10px] text-red-500/60 hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-40"
                  >
                    {closingForum ? 'Closing…' : 'Close'}
                  </button>
                ) : (
                  <button
                    onClick={handleLeaveForum}
                    disabled={leavingForum}
                    className="text-[10px] text-[#4A2C14] hover:text-[#A08060] transition-colors flex-shrink-0 disabled:opacity-40"
                  >
                    {leavingForum ? 'Leaving…' : 'Leave'}
                  </button>
                )}
              </div>

              {/* Invite picker */}
              {showInvite && (
                <div className="px-4 py-3 flex flex-col gap-1.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(74,44,20,0.3)', background: 'rgba(14,8,4,0.4)' }}>
                  <p className="text-[10px] uppercase tracking-wider text-[#6B4020]">Invite a friend</p>
                  {nonMemberFriends.length === 0 ? (
                    <p className="text-[10px] text-[#3B1F0E]">All friends are already in this forum</p>
                  ) : nonMemberFriends.map(f => (
                    <div key={f.id} className="flex items-center justify-between">
                      <p className="text-xs text-[#A08060] truncate">{nicknames[f.profile.id] ?? f.profile.display_name ?? f.profile.email}</p>
                      <button
                        onClick={() => handleInviteFriend(f.profile.id)}
                        disabled={invitingIds.has(f.profile.id)}
                        className="text-[10px] text-[#D4A55A] hover:text-[#F5E6C8] transition-colors flex-shrink-0 ml-2 disabled:opacity-40"
                      >
                        {invitingIds.has(f.profile.id) ? '…' : '+ Invite'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
                {loadingMessages && messages.length === 0 && (
                  <p className="text-xs text-center text-[#4A2C14] mt-8">Loading messages…</p>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <p className="text-xs text-center text-[#3B1F0E] mt-8">No messages yet — say something!</p>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.user_id === userId
                  const senderName = isMe ? 'You' : (nicknames[msg.user_id] ?? msg.profile?.display_name ?? msg.profile?.email ?? '?')
                  const showSender = i === 0 || messages[i - 1].user_id !== msg.user_id
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {showSender && <p className="text-[9px] text-[#4A2C14] mb-0.5 px-1">{senderName}</p>}
                      <div
                        className="max-w-[80%] px-3 py-2 text-xs leading-snug"
                        style={{
                          background: isMe ? 'rgba(212,165,90,0.15)' : 'rgba(44,24,16,0.6)',
                          border: `1px solid ${isMe ? 'rgba(212,165,90,0.35)' : 'rgba(74,44,20,0.3)'}`,
                          color: '#F5E6C8',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        }}
                      >
                        {msg.content}
                      </div>
                      <p className="text-[9px] text-[#2C1810] mt-0.5 px-1">{timeAgo(msg.created_at)}</p>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(74,44,20,0.3)' }}>
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                  placeholder="Type a message…"
                  className="flex-1 min-w-0 text-sm rounded-xl px-3 py-2 focus:outline-none"
                  style={{ background: '#0E0804', border: '1px solid rgba(74,44,20,0.7)', color: '#F5E6C8' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#D4A55A' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(74,44,20,0.7)' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageInput.trim()}
                  className="p-2 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                  style={{ background: messageInput.trim() ? '#D4A55A' : 'rgba(44,24,16,0.5)', color: messageInput.trim() ? '#1C0E06' : '#4A2C14' }}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Friends tab ───────────────────────────────────────────── */}
          {tab === 'friends' && (
            <div className="p-4 flex flex-col gap-5">

              {/* Search */}
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A2C14] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by email or name…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none transition-colors"
                    style={{ background: '#0E0804', border: '1px solid rgba(74,44,20,0.7)', color: '#F5E6C8' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#D4A55A' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(74,44,20,0.7)' }}
                  />
                </div>
                {searching && <p className="text-xs text-[#4A2C14] mt-2 text-center">Searching…</p>}
                {searchResults.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {searchResults.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(44,24,16,0.5)' }}>
                        <div className="min-w-0">
                          <p className="text-sm text-[#F5E6C8] truncate">{p.display_name ?? p.email}</p>
                          {p.display_name && <p className="text-xs text-[#4A2C14] truncate">{p.email}</p>}
                        </div>
                        {sentRequests.has(p.id) ? (
                          <span className="flex items-center gap-1 text-xs text-[#4A2C14] flex-shrink-0 ml-2">
                            <Check className="w-3 h-3 text-[#D4A55A]" /> Sent
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(p.id)}
                            className="flex items-center gap-1 text-xs text-[#D4A55A] hover:text-[#F5E6C8] transition-colors flex-shrink-0 ml-2"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Add
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending requests */}
              {pending.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#6B4020] mb-2">Friend Requests</p>
                  <div className="flex flex-col gap-1.5">
                    {pending.map(f => (
                      <div key={f.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(44,24,16,0.5)', border: '1px solid rgba(74,44,20,0.3)' }}>
                        <div className="min-w-0 mr-2">
                          <p className="text-sm text-[#F5E6C8] truncate">{f.profile.display_name ?? f.profile.email}</p>
                          {f.profile.display_name && <p className="text-xs text-[#4A2C14] truncate">{f.profile.email}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleAccept(f)} className="text-xs text-[#D4A55A] hover:text-[#F5E6C8] transition-colors font-medium">Accept</button>
                          <button onClick={() => handleDecline(f.id)} className="text-xs text-[#4A2C14] hover:text-red-400 transition-colors">Decline</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friends list */}
              <div>
                <p className="text-xs uppercase tracking-wider text-[#6B4020] mb-2">
                  Friends{friends.length > 0 ? ` (${friends.length})` : ''}
                </p>
                {friends.length === 0 ? (
                  <p className="text-xs text-[#2C1810]">No friends yet — search above to add someone</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {friends.map(f => {
                      const isEditing = editingUserId === f.profile.id
                      const displayName = nicknames[f.profile.id] ?? f.profile.display_name ?? f.profile.email
                      return (
                        <div key={f.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(44,24,16,0.5)' }}>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
                              <input
                                autoFocus
                                type="text"
                                value={nicknameInput}
                                onChange={e => setNicknameInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveNickname(f.profile.id)
                                  if (e.key === 'Escape') setEditingUserId(null)
                                }}
                                placeholder={f.profile.email}
                                className="flex-1 min-w-0 text-sm rounded px-2 py-0.5 focus:outline-none"
                                style={{ background: '#0E0804', border: '1px solid #D4A55A', color: '#F5E6C8' }}
                              />
                              <button onClick={() => saveNickname(f.profile.id)} className="p-1 text-[#D4A55A] hover:text-[#F5E6C8] transition-colors flex-shrink-0" title="Save">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingUserId(null)} className="p-1 text-[#4A2C14] hover:text-[#A08060] transition-colors flex-shrink-0" title="Cancel">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0 mr-2">
                              <p className="text-sm text-[#F5E6C8] truncate">{displayName}</p>
                              <p className="text-xs text-[#4A2C14] truncate">{f.profile.email}</p>
                            </div>
                          )}
                          {!isEditing && (
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button
                                onClick={() => { setEditingUserId(f.profile.id); setNicknameInput(nicknames[f.profile.id] ?? '') }}
                                className="p-1 text-[#4A2C14] hover:text-[#A08060] transition-colors"
                                title="Rename"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleRemoveFriend(f.id)} className="p-1 text-[#4A2C14] hover:text-red-400 transition-colors" title="Remove friend">
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Rec card ───────────────────────────────────────────────────────────────────

interface RecCardProps {
  rec: Recommendation
  sections: Section[]
  onAddToLibrary: (book: Book, sectionId: string) => Promise<void>
  nicknames: Record<string, string>
}

function RecCard({ rec, sections, onAddToLibrary, nicknames }: RecCardProps) {
  const name = nicknames[rec.recommender?.id ?? ''] ?? rec.recommender?.display_name ?? rec.recommender?.email ?? 'Someone'
  const { book } = rec

  const [picking, setPicking]   = useState(false)
  const [adding, setAdding]     = useState(false)
  const [added, setAdded]       = useState(false)
  const [addError, setAddError] = useState('')

  const handlePickSection = async (sectionId: string) => {
    setAdding(true)
    setAddError('')
    try {
      await onAddToLibrary(book, sectionId)
      setPicking(false)
      setAdded(true)
      setTimeout(() => setAdded(false), 2500)
    } catch (e) {
      setPicking(false)
      if (e instanceof DuplicateBookError) setAddError('Already on your shelf')
      else setAddError('Failed to add')
      setTimeout(() => setAddError(''), 2500)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="p-3 rounded-xl" style={{ background: 'rgba(44,24,16,0.45)', border: '1px solid rgba(74,44,20,0.3)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#D4A55A]" style={{ background: 'rgba(74,44,20,0.7)' }}>
          {name[0].toUpperCase()}
        </div>
        <p className="text-xs text-[#A08060]">
          <span className="text-[#D4A55A] font-semibold">{name}</span>{' '}recommends
        </p>
      </div>
      <div className="flex items-start gap-3">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.cover_url} alt="" className="rounded flex-shrink-0" style={{ width: 32, height: 48, objectFit: 'cover' }} />
        ) : (
          <div className="rounded flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 48, background: 'rgba(59,31,14,0.6)' }}>
            <BookOpen className="w-3 h-3 text-[#3B1F0E]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#F5E6C8] leading-snug line-clamp-2">{book.title}</p>
          {book.authors[0] && <p className="text-xs text-[#6B4020] truncate mt-0.5">{book.authors[0]}</p>}
          {rec.user_rating != null && <div className="mt-1.5"><StarRating value={rec.user_rating} readOnly size={13} /></div>}
        </div>
      </div>
      {rec.note && <p className="text-xs text-[#A08060] italic mt-2 leading-relaxed">&ldquo;{rec.note}&rdquo;</p>}
      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-[#3B1F0E]">{timeAgo(rec.created_at)}</p>
        {added ? (
          <span className="flex items-center gap-1 text-[10px] text-[#D4A55A]"><Check className="w-3 h-3" /> Added!</span>
        ) : addError ? (
          <span className="text-[10px] text-red-400">{addError}</span>
        ) : (
          <button
            onClick={() => setPicking(v => !v)}
            disabled={adding}
            className="flex items-center gap-1 text-[10px] transition-colors disabled:opacity-40"
            style={{ color: picking ? '#D4A55A' : '#6B4020' }}
            onMouseEnter={e => { if (!picking) e.currentTarget.style.color = '#A08060' }}
            onMouseLeave={e => { if (!picking) e.currentTarget.style.color = '#6B4020' }}
            title="Add to your library"
          >
            <BookPlus className="w-3 h-3" />
            {adding ? 'Adding…' : 'Add to library'}
          </button>
        )}
      </div>
      {picking && !adding && (
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(74,44,20,0.3)' }}>
          <p className="text-[10px] text-[#6B4020] mb-1.5 uppercase tracking-wider">Choose a section</p>
          <div className="flex flex-wrap gap-1.5">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => handlePickSection(s.id)}
                className="px-2.5 py-1 rounded-full text-[10px] transition-colors"
                style={{ background: 'rgba(44,24,16,0.8)', border: '1px solid rgba(74,44,20,0.6)', color: '#A08060' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4A55A'; e.currentTarget.style.color = '#D4A55A' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(74,44,20,0.6)'; e.currentTarget.style.color = '#A08060' }}
              >
                {s.name}
              </button>
            ))}
            <button onClick={() => setPicking(false)} className="px-2 py-1 text-[10px] text-[#4A2C14] hover:text-[#6B4020] transition-colors">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

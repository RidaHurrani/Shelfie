"use client"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { BookOpen } from "lucide-react"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ready, setReady]         = useState(false)   // true once session established
  const [exchangeErr, setExchangeErr] = useState("")

  const [password, setPassword]   = useState("")
  const [confirm, setConfirm]     = useState("")
  const [loading, setLoading]     = useState(false)
  const [errorMsg, setErrorMsg]   = useState("")
  const [done, setDone]           = useState(false)

  // Exchange the code Supabase appends to the URL for a live session
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setExchangeErr("Invalid or missing reset link. Please request a new one.")
      return
    }
    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setExchangeErr("This reset link has expired or already been used. Please request a new one.")
      } else {
        setReady(true)
      }
    })
  }, [searchParams])

  const onSubmit = async () => {
    if (password.length < 6) { setErrorMsg("Password must be at least 6 characters."); return }
    if (password !== confirm)  { setErrorMsg("Passwords don't match."); return }
    setLoading(true)
    setErrorMsg("")
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setErrorMsg(error.message)
      } else {
        setDone(true)
        setTimeout(() => router.push("/library"), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1C1008] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BookOpen className="w-10 h-10 text-[#D4A55A]" />
            <h1 className="text-5xl font-bold text-[#D4A55A]" style={{ fontFamily: 'var(--font-playfair)' }}>
              Shelfie
            </h1>
          </div>
        </div>

        <div className="bg-[#2C1810] border border-[#4A2C14] rounded-2xl p-8 shadow-2xl">

          {/* Exchange error */}
          {exchangeErr && (
            <div className="flex flex-col items-center text-center py-4">
              <p className="text-sm text-red-400 mb-6">{exchangeErr}</p>
              <button
                onClick={() => router.push("/login")}
                className="text-sm text-[#D4A55A] hover:underline"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          {/* Loading while exchanging code */}
          {!exchangeErr && !ready && (
            <p className="text-sm text-center text-[#A08060] py-8">Verifying reset link…</p>
          )}

          {/* Success */}
          {done && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(212,165,90,0.15)', border: '1px solid rgba(212,165,90,0.3)' }}>
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="text-xl font-semibold text-[#F5E6C8] mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                Password updated!
              </h2>
              <p className="text-sm text-[#A08060]">Taking you to your library…</p>
            </div>
          )}

          {/* Password form */}
          {ready && !done && (
            <>
              <h2 className="text-2xl font-semibold text-[#F5E6C8] mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                Choose a new password
              </h2>
              <p className="text-sm text-[#A08060] mb-6">Pick something you&apos;ll remember.</p>

              {errorMsg && <p className="text-sm text-red-400 mb-4">{errorMsg}</p>}

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-[#A08060]" htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    className="bg-[#1C1008] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#5A3A20] focus:outline-none focus:border-[#D4A55A] transition-colors"
                    onKeyDown={e => e.key === 'Enter' && onSubmit()}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-[#A08060]" htmlFor="confirm-password">Confirm password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="bg-[#1C1008] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#5A3A20] focus:outline-none focus:border-[#D4A55A] transition-colors"
                    onKeyDown={e => e.key === 'Enter' && onSubmit()}
                  />
                </div>
              </div>

              <button
                onClick={onSubmit}
                disabled={loading || !password || !confirm}
                className="w-full mt-6 bg-[#D4A55A] hover:bg-[#C49040] disabled:opacity-50 text-[#1C1008] font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {loading ? "Saving…" : "Set new password"}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#1C1008]">
        <p className="text-[#A08060] text-sm">Loading…</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

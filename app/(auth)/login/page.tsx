"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { BookOpen } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading]   = useState(false)

  // Forgot-password state
  const [forgotMode, setForgotMode]   = useState(false)
  const [resetEmail, setResetEmail]   = useState("")
  const [resetSent, setResetSent]     = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const onLogin = async () => {
    setLoading(true)
    setErrorMsg("")
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMsg(error.message)
        setTimeout(() => setErrorMsg(""), 4000)
        return
      }
      router.push("/library")
    } finally {
      setLoading(false)
    }
  }

  const onResetRequest = async () => {
    if (!resetEmail.trim()) return
    setResetLoading(true)
    setErrorMsg("")
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setErrorMsg(error.message)
        setTimeout(() => setErrorMsg(""), 4000)
      } else {
        setResetSent(true)
      }
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1C1008] px-4">
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-500 text-red-200 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 max-w-sm">
          <span className="flex-1 text-sm">{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-red-300 font-bold text-lg leading-none hover:text-red-100">&times;</button>
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BookOpen className="w-10 h-10 text-[#D4A55A]" />
            <h1 className="text-5xl font-bold text-[#D4A55A]" style={{ fontFamily: 'var(--font-playfair)' }}>
              Shelfie
            </h1>
          </div>
          <p className="text-[#A08060] text-sm">Your personal library awaits</p>
        </div>

        {/* Card */}
        <div className="bg-[#2C1810] border border-[#4A2C14] rounded-2xl p-8 shadow-2xl">

          {/* ── Sign-in form ── */}
          {!forgotMode && (
            <>
              <h2 className="text-2xl font-semibold text-[#F5E6C8] mb-6" style={{ fontFamily: 'var(--font-playfair)' }}>
                Welcome back
              </h2>

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-[#A08060]" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="reader@example.com"
                    className="bg-[#1C1008] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#5A3A20] focus:outline-none focus:border-[#D4A55A] transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-[#A08060]" htmlFor="password">Password</label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setResetEmail(email) }}
                      className="text-xs text-[#6B4020] hover:text-[#A08060] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-[#1C1008] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#5A3A20] focus:outline-none focus:border-[#D4A55A] transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                  />
                </div>
              </div>

              <button
                onClick={onLogin}
                disabled={loading}
                className="w-full mt-6 bg-[#D4A55A] hover:bg-[#C49040] disabled:opacity-50 text-[#1C1008] font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <p className="text-center text-sm text-[#A08060] mt-4">
                No account yet?{" "}
                <Link href="/signup" className="text-[#D4A55A] hover:underline">Create one</Link>
              </p>
            </>
          )}

          {/* ── Forgot-password form ── */}
          {forgotMode && !resetSent && (
            <>
              <h2 className="text-2xl font-semibold text-[#F5E6C8] mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                Reset password
              </h2>
              <p className="text-sm text-[#A08060] mb-6">
                Enter your email and we&apos;ll send you a link to set a new password.
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#A08060]" htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="reader@example.com"
                  className="bg-[#1C1008] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#5A3A20] focus:outline-none focus:border-[#D4A55A] transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && onResetRequest()}
                  autoFocus
                />
              </div>

              <button
                onClick={onResetRequest}
                disabled={resetLoading || !resetEmail.trim()}
                className="w-full mt-6 bg-[#D4A55A] hover:bg-[#C49040] disabled:opacity-50 text-[#1C1008] font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {resetLoading ? "Sending…" : "Send reset link"}
              </button>

              <button
                onClick={() => setForgotMode(false)}
                className="w-full mt-3 text-sm text-[#6B4020] hover:text-[#A08060] transition-colors"
              >
                ← Back to sign in
              </button>
            </>
          )}

          {/* ── Email sent confirmation ── */}
          {forgotMode && resetSent && (
            <>
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(212,165,90,0.15)', border: '1px solid rgba(212,165,90,0.3)' }}>
                  <span className="text-2xl">✉</span>
                </div>
                <h2 className="text-xl font-semibold text-[#F5E6C8] mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                  Check your inbox
                </h2>
                <p className="text-sm text-[#A08060]">
                  We sent a password reset link to <span className="text-[#D4A55A]">{resetEmail}</span>.
                </p>
              </div>

              <button
                onClick={() => { setForgotMode(false); setResetSent(false) }}
                className="w-full mt-6 text-sm text-[#6B4020] hover:text-[#A08060] transition-colors"
              >
                ← Back to sign in
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

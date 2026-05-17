"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { BookOpen } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)

  const onSignup = async () => {
    if (!displayName || !email || !password) {
      setErrorMsg("Please fill out all fields.")
      setTimeout(() => setErrorMsg(""), 4000)
      return
    }
    setLoading(true)
    setErrorMsg("")
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setErrorMsg(error.message)
        setTimeout(() => setErrorMsg(""), 4000)
        return
      }
      if (data.user) {
        await supabase
          .from('profiles')
          .update({ display_name: displayName })
          .eq('id', data.user.id)
      }
      router.push("/library")
    } finally {
      setLoading(false)
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
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BookOpen className="w-10 h-10 text-[#D4A55A]" />
            <h1 className="text-5xl font-bold text-[#D4A55A]" style={{ fontFamily: 'var(--font-playfair)' }}>
              Shelfie
            </h1>
          </div>
          <p className="text-[#A08060] text-sm">Build your dream library</p>
        </div>

        <div className="bg-[#2C1810] border border-[#4A2C14] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-[#F5E6C8] mb-6" style={{ fontFamily: 'var(--font-playfair)' }}>
            Create account
          </h2>

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#A08060]" htmlFor="displayName">Your name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="E.g. Alex"
                className="bg-[#1C1008] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#5A3A20] focus:outline-none focus:border-[#D4A55A] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#A08060]" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@example.com"
                className="bg-[#1C1008] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#5A3A20] focus:outline-none focus:border-[#D4A55A] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#A08060]" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="bg-[#1C1008] border border-[#4A2C14] text-[#F5E6C8] rounded-lg px-4 py-2.5 text-sm placeholder-[#5A3A20] focus:outline-none focus:border-[#D4A55A] transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && onSignup()}
              />
            </div>
          </div>

          <button
            onClick={onSignup}
            disabled={loading}
            className="w-full mt-6 bg-[#D4A55A] hover:bg-[#C49040] disabled:opacity-50 text-[#1C1008] font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? "Creating library..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-[#A08060] mt-4">
            Already a reader?{" "}
            <Link href="/login" className="text-[#D4A55A] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

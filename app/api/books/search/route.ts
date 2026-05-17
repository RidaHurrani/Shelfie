import { NextRequest, NextResponse } from 'next/server'
import { searchBooks } from '@/lib/google-books'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json([])
  }
  try {
    const results = await searchBooks(q)
    return NextResponse.json(results)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

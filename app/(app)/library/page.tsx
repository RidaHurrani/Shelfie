import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSectionsWithEntries } from '@/lib/queries'
import LibraryRoom from '@/components/library/LibraryRoom'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) {
    redirect('/login')
  }

  const userId = data.claims.sub
  const sections = await getSectionsWithEntries(userId)

  return <LibraryRoom initialSections={sections} userId={userId} />
}

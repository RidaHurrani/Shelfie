import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getSectionsWithEntries,
  getFriendsRecommendations,
  getAcceptedFriends,
  getPendingFriendRequests,
  getMyRecommendations,
} from '@/lib/queries'
import LibraryRoom from '@/components/library/LibraryRoom'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) {
    redirect('/login')
  }

  const userId = data.claims.sub

  const [sections, friendsRecs, friends, pending, myRecs] = await Promise.all([
    getSectionsWithEntries(userId),
    getFriendsRecommendations(userId),
    getAcceptedFriends(userId),
    getPendingFriendRequests(userId),
    getMyRecommendations(userId),
  ])

  return (
    <LibraryRoom
      initialSections={sections}
      userId={userId}
      initialFriendsRecs={friendsRecs}
      initialFriends={friends}
      initialPendingRequests={pending}
      initialMyRecs={myRecs}
    />
  )
}

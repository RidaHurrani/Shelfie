import { createClient } from './supabase/server'
import { SectionWithEntries } from './types'

export async function getSectionsWithEntries(userId: string): Promise<SectionWithEntries[]> {
  const supabase = await createClient()

  const { data: sections, error: secErr } = await supabase
    .from('sections')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })

  if (secErr || !sections) return []

  const { data: entries, error: entErr } = await supabase
    .from('shelf_entries')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (entErr || !entries) {
    return sections.map((s) => ({ ...s, entries: [] }))
  }

  return sections.map((section) => ({
    ...section,
    entries: entries.filter((e) => e.section_id === section.id),
  }))
}

import type { Entry, EventDoc, Guest, Pay, TicketType } from './types'

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9@ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const fullName = (g?: Pick<Guest, 'firstName' | 'lastName'>) =>
  g ? `${g.firstName} ${g.lastName}` : 'Unbekannt'

export function matchesSearch(g: Guest | undefined, q: string) {
  if (!q.trim()) return true
  if (!g) return false
  const hay = normalize(`${g.firstName} ${g.lastName} ${g.instagram ?? ''} ${g.phone ?? ''}`)
  return normalize(q)
    .split(' ')
    .every((t) => hay.includes(t))
}

// Eine Veranstaltung gilt ab 12 Uhr am Folgetag als vorbei (Nächte gehen über Mitternacht).
export function eventEnd(ev: EventDoc) {
  const d = new Date(`${ev.date}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.getTime()
}
export const isOver = (ev: EventDoc, now = Date.now()) => eventEnd(ev) < now

export function deadlinePassed(ev: EventDoc, now = Date.now()) {
  return !!ev.deadline && new Date(ev.deadline).getTime() < now
}

// Die "aktuelle" Veranstaltung für die Kasse: die nächste, die noch nicht vorbei ist.
export function currentEvent(events: EventDoc[]) {
  const upcoming = events.filter((e) => !isOver(e)).sort((a, b) => a.date.localeCompare(b.date))
  if (upcoming.length) return upcoming[0]
  return [...events].sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function priceFor(tt: TicketType | undefined, pay?: Pay): number {
  if (!tt || !tt.paid) return 0
  const base = tt.defaultPrice || 0
  if (!pay || pay.mode === 'full') return base
  const v = pay.discountValue ?? 0
  if (pay.discountKind === 'price') return Math.max(0, v)
  return Math.max(0, Math.round(base * (1 - v / 100) * 100) / 100)
}

export function payLabel(tt: TicketType | undefined, pay?: Pay) {
  if (!tt || !tt.paid) return ''
  const p = euro(priceFor(tt, pay))
  if (!pay || pay.mode === 'full') return `${p} (voll)`
  if (pay.discountKind === 'percent') return `${p} (−${pay.discountValue ?? 0} %)`
  return `${p} (Rabatt)`
}

export const euro = (n: number) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

export const persons = (e: Entry) => 1 + e.plus.length

export const checkedInPersons = (e: Entry) =>
  (e.checkedInAt ? 1 : 0) + e.plus.filter((p) => p.checkedInAt).length

export function entryTotal(e: Entry, tts: Map<string, TicketType>) {
  return priceFor(tts.get(e.ticketTypeId), e.pay) + e.plus.reduce((s, p) => s + priceFor(tts.get(p.ticketTypeId), p.pay), 0)
}

export type GuestStats = { listed: number; came: number; noShows: number; lastVisit: number | null }

// Statistik pro Gast über alle vergangenen Veranstaltungen.
export function guestStats(entries: Entry[], events: Map<string, EventDoc>) {
  const stats = new Map<string, GuestStats>()
  const now = Date.now()
  for (const e of entries) {
    if (e.status !== 'approved') continue
    const ev = events.get(e.eventId)
    if (!ev) continue
    const s = stats.get(e.guestId) ?? { listed: 0, came: 0, noShows: 0, lastVisit: null }
    if (e.checkedInAt) {
      s.listed++
      s.came++
      s.lastVisit = Math.max(s.lastVisit ?? 0, e.checkedInAt)
    } else if (isOver(ev, now)) {
      s.listed++
      s.noShows++
    }
    stats.set(e.guestId, s)
  }
  return stats
}

export const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

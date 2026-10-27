import { getDocsFromCache, collection } from 'firebase/firestore'
import { db } from './firebase'
import type { Entry, EventDoc, Guest, TicketType } from './types'
import { entryTotal, fmtDate, fmtDateTime, fmtTime, guestStats, payLabel } from './logic'

async function load() {
  const get = async <T,>(name: string) =>
    (await getDocsFromCache(collection(db, name))).docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T)
  const [events, entries, guests, tts] = await Promise.all([
    get<EventDoc>('events'),
    get<Entry>('entries'),
    get<Guest>('guests'),
    get<TicketType>('ticketTypes'),
  ])
  return {
    events,
    entries,
    eventMap: new Map(events.map((e) => [e.id, e])),
    guestMap: new Map(guests.map((g) => [g.id, g])),
    guests,
    ttMap: new Map(tts.map((t) => [t.id, t])),
  }
}

async function download(rows: Record<string, unknown>[], sheet: string, file: string) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(10, k.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31))
  XLSX.writeFile(wb, file)
}

const safe = (s: string) => s.replace(/[^\wäöüÄÖÜß -]/g, '').trim()

export async function exportEvent(eventId: string) {
  const d = await load()
  const ev = d.eventMap.get(eventId)!
  const rows = d.entries
    .filter((e) => e.eventId === eventId && e.status === 'approved')
    .map((e) => ({ e, g: d.guestMap.get(e.guestId) }))
    .sort((a, b) => (a.g?.lastName ?? '').localeCompare(b.g?.lastName ?? '', 'de'))
    .map(({ e, g }) => {
      const tt = d.ttMap.get(e.ticketTypeId)
      return {
        Nachname: g?.lastName ?? '',
        Vorname: g?.firstName ?? '',
        Ticket: [tt?.name, payLabel(tt, e.pay)].filter(Boolean).join(' '),
        Begleitung: e.plus.map((p) => { const t = d.ttMap.get(p.ticketTypeId); return `+1 ${[t?.name, payLabel(t, p.pay)].filter(Boolean).join(' ')}` }).join(', '),
        Personen: 1 + e.plus.length,
        'Betrag (€)': entryTotal(e, d.ttMap),
        'Eingecheckt um': e.checkedInAt ? fmtTime(e.checkedInAt) : '',
        'Begleitung da': `${e.plus.filter((p) => p.checkedInAt).length}/${e.plus.length}`,
        Telefon: g?.phone ?? '',
        Instagram: g?.instagram ? '@' + g.instagram : '',
        'Eingetragen von': e.addedBy,
        Notiz: e.note ?? '',
      }
    })
  await download(rows, ev.name, `Gästeliste ${safe(ev.name)} ${ev.date}.xlsx`)
}

export async function exportGuests() {
  const d = await load()
  const stats = guestStats(d.entries, d.eventMap)
  const rows = [...d.guests]
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
    .map((g) => {
      const s = stats.get(g.id) ?? { listed: 0, came: 0, noShows: 0, lastVisit: null }
      const evs = d.entries.filter((e) => e.guestId === g.id).map((e) => d.eventMap.get(e.eventId)).filter(Boolean) as EventDoc[]
      return {
        Nachname: g.lastName,
        Vorname: g.firstName,
        Telefon: g.phone ?? '',
        Instagram: g.instagram ? '@' + g.instagram : '',
        'Auf Liste (abgeschlossen)': s.listed,
        Gekommen: s.came,
        'No-Shows': s.noShows,
        'Zuverlässigkeit %': s.listed ? Math.round((s.came / s.listed) * 100) : '',
        'Zuletzt da': s.lastVisit ? fmtDateTime(s.lastVisit) : '',
        Veranstaltungen: evs.sort((a, b) => b.date.localeCompare(a.date)).map((e) => `${e.name} (${fmtDate(e.date)})`).join('; '),
        Info: g.note ?? '',
      }
    })
  await download(rows, 'Gäste', `Gäste-Datenbank ${new Date().toISOString().slice(0, 10)}.xlsx`)
}

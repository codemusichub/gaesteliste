import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Entry, EventDoc, Guest, Role, Settings, TicketType } from './types'
import { guestStats, type GuestStats } from './logic'

type Data = {
  ready: boolean
  events: EventDoc[]
  entries: Entry[]
  guests: Guest[]
  ticketTypes: TicketType[]
  settings: Settings
  eventMap: Map<string, EventDoc>
  guestMap: Map<string, Guest>
  ttMap: Map<string, TicketType>
  stats: Map<string, GuestStats>
  pending: boolean
  online: boolean
}

const Ctx = createContext<Data | null>(null)
export const useData = () => useContext(Ctx)!

const DEFAULT_TICKETS: TicketType[] = [
  { id: 'free', name: 'Free', color: '#3ddc97', paid: false, defaultPrice: 0, order: 1 },
  { id: 'zahler', name: 'Zahler', color: '#ffb547', paid: true, defaultPrice: 15, order: 2 },
  { id: 'vip', name: 'VIP / Stage', color: '#c08bff', paid: false, defaultPrice: 0, order: 3 },
]

export function DataProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [events, setEvents] = useState<EventDoc[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [settings, setSettings] = useState<Settings>({})
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({})
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const sub = <T,>(name: string, set: (v: T[]) => void) =>
      onSnapshot(collection(db, name), { includeMetadataChanges: true }, (snap) => {
        set(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T))
        setLoaded((l) => (l[name] ? l : { ...l, [name]: true }))
        setPendingMap((p) => ({ ...p, [name]: snap.metadata.hasPendingWrites }))
        if (name === 'ticketTypes' && role === 'admin' && snap.empty && !snap.metadata.fromCache) {
          const b = writeBatch(db)
          DEFAULT_TICKETS.forEach(({ id, ...t }) => b.set(doc(db, 'ticketTypes', id), t))
          b.commit()
        }
      })
    const unsubs = [
      sub<EventDoc>('events', setEvents),
      sub<Entry>('entries', setEntries),
      sub<Guest>('guests', setGuests),
      sub<TicketType>('ticketTypes', setTicketTypes),
      onSnapshot(doc(db, 'meta', 'settings'), (d) => setSettings((d.data() as Settings) ?? {})),
    ]
    return () => unsubs.forEach((u) => u())
  }, [role])

  const value = useMemo<Data>(() => {
    const eventMap = new Map(events.map((e) => [e.id, e]))
    const sortedTT = [...ticketTypes].sort((a, b) => a.order - b.order)
    return {
      ready: ['events', 'entries', 'guests', 'ticketTypes'].every((k) => loaded[k]),
      events: [...events].sort((a, b) => b.date.localeCompare(a.date)),
      entries,
      guests,
      ticketTypes: sortedTT,
      settings,
      eventMap,
      guestMap: new Map(guests.map((g) => [g.id, g])),
      ttMap: new Map(sortedTT.map((t) => [t.id, t])),
      stats: guestStats(entries, eventMap),
      pending: Object.values(pendingMap).some(Boolean),
      online,
    }
  }, [events, entries, guests, ticketTypes, settings, loaded, pendingMap, online])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// Schreibzugriffe. Bewusst ohne await im UI: Offline werden sie lokal gespeichert und später synchronisiert.
const newId = (c: string) => doc(collection(db, c)).id
const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export const actions = {
  newId,
  saveEvent(ev: EventDoc) {
    const { id, ...rest } = ev
    return setDoc(doc(db, 'events', id), clean(rest))
  },
  async deleteEvent(id: string, entries: Entry[]) {
    const b = writeBatch(db)
    entries.filter((e) => e.eventId === id).forEach((e) => b.delete(doc(db, 'entries', e.id)))
    b.delete(doc(db, 'events', id))
    return b.commit()
  },
  saveGuest(g: Guest) {
    const { id, ...rest } = g
    return setDoc(doc(db, 'guests', id), clean(rest))
  },
  async deleteGuest(id: string, entries: Entry[]) {
    const b = writeBatch(db)
    entries.filter((e) => e.guestId === id).forEach((e) => b.delete(doc(db, 'entries', e.id)))
    b.delete(doc(db, 'guests', id))
    return b.commit()
  },
  saveEntry(e: Entry) {
    const { id, ...rest } = e
    return setDoc(doc(db, 'entries', id), clean({ ...rest, plus: rest.plus.map(clean) }))
  },
  deleteEntry(id: string) {
    return deleteDoc(doc(db, 'entries', id))
  },
  setCheckIn(e: Entry, main: number | null, plus: (number | null)[], by: string) {
    return updateDoc(doc(db, 'entries', e.id), {
      checkedInAt: main,
      checkedInBy: by,
      plus: e.plus.map((p, i) => clean({ ...p, checkedInAt: plus[i] ?? null })),
    })
  },
  saveTicketType(t: TicketType) {
    const { id, ...rest } = t
    return setDoc(doc(db, 'ticketTypes', id), clean(rest))
  },
  saveSettings(s: Settings) {
    return setDoc(doc(db, 'meta', 'settings'), s, { merge: true })
  },
}

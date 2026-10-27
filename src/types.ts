export type Role = 'admin' | 'kasse'

export type TicketType = {
  id: string
  name: string
  color: string
  paid: boolean
  defaultPrice: number
  order: number
  archived?: boolean
}

// Zahlweise für zahlende Tickets: Vollpreis oder Rabatt (Prozent oder fester Preis).
export type Pay = {
  mode: 'full' | 'discount'
  discountKind?: 'percent' | 'price'
  discountValue?: number
}

export type PlusPerson = {
  ticketTypeId: string
  pay?: Pay
  checkedInAt?: number | null
}

export type Entry = {
  id: string
  eventId: string
  guestId: string
  ticketTypeId: string
  pay?: Pay
  plus: PlusPerson[]
  note?: string
  addedBy: string
  createdAt: number
  createdByEmail?: string
  checkedInAt: number | null
  checkedInBy?: string
  status: 'approved' | 'pending'
}

export type Guest = {
  id: string
  firstName: string
  lastName: string
  phone?: string
  instagram?: string
  note?: string
  createdAt: number
}

export type EventDoc = {
  id: string
  name: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  limit?: number | null
  deadline?: string | null // YYYY-MM-DDTHH:MM (lokal)
  createdAt: number
}

export type Settings = {
  addedByNames?: string[]
}

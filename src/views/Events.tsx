import { useState } from 'react'
import { actions, useData } from '../data'
import type { EventDoc } from '../types'
import { checkedInPersons, fmtDate, isOver, persons, todayISO } from '../logic'
import { Empty, Field, Sheet, SyncBadge, navigate } from '../ui'

export function EventsPage() {
  const { events, entries } = useData()
  const [form, setForm] = useState(false)
  const upcoming = events.filter((e) => !isOver(e)).sort((a, b) => a.date.localeCompare(b.date))
  const past = events.filter((e) => isOver(e))

  const card = (ev: EventDoc) => {
    const list = entries.filter((e) => e.eventId === ev.id && e.status === 'approved')
    const total = list.reduce((s, e) => s + persons(e), 0)
    const inside = list.reduce((s, e) => s + checkedInPersons(e), 0)
    const over = isOver(ev)
    return (
      <button key={ev.id} className="card event-card" onClick={() => navigate(`/event/${ev.id}`)}>
        <div>
          <div className="name">{ev.name}</div>
          <div className="muted small">{fmtDate(ev.date)}{ev.time ? ` · ${ev.time} Uhr` : ''}</div>
        </div>
        <div className="event-num">
          {over ? (
            <>
              <b>{total ? Math.round((inside / total) * 100) : 0} %</b>
              <span className="muted small">{inside}/{total} da</span>
            </>
          ) : (
            <>
              <b>{total}</b>
              <span className="muted small">{ev.limit ? `von ${ev.limit}` : 'Personen'}</span>
            </>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="page-pad">
      <div className="topbar">
        <div className="topbar-title"><h1>Veranstaltungen</h1></div>
        <SyncBadge />
      </div>
      <button className="btn primary big" onClick={() => setForm(true)}>+ Neue Veranstaltung</button>
      <h3>Anstehend</h3>
      {upcoming.length ? upcoming.map(card) : <Empty>Keine anstehenden Veranstaltungen.</Empty>}
      {past.length > 0 && (
        <>
          <h3>Vergangen</h3>
          {past.map(card)}
        </>
      )}
      {form && <EventForm onClose={() => setForm(false)} />}
    </div>
  )
}

export function EventForm({ event, onClose }: { event?: EventDoc; onClose: () => void }) {
  const { entries } = useData()
  const [name, setName] = useState(event?.name ?? '')
  const [date, setDate] = useState(event?.date ?? todayISO())
  const [time, setTime] = useState(event?.time ?? '23:00')
  const [useLimit, setUseLimit] = useState(!!event?.limit)
  const [limit, setLimit] = useState(event?.limit ?? 50)
  const [useDeadline, setUseDeadline] = useState(!!event?.deadline)
  const [deadline, setDeadline] = useState(event?.deadline ?? `${event?.date ?? todayISO()}T20:00`)
  const [err, setErr] = useState('')

  const save = () => {
    if (!name.trim() || !date) return setErr('Name und Datum sind Pflicht.')
    const ev: EventDoc = {
      id: event?.id ?? actions.newId('events'),
      name: name.trim(),
      date,
      time: time || undefined,
      limit: useLimit ? Number(limit) || null : null,
      deadline: useDeadline ? deadline : null,
      createdAt: event?.createdAt ?? Date.now(),
    }
    actions.saveEvent(ev)
    onClose()
    if (!event) navigate(`/event/${ev.id}`)
  }
  const remove = () => {
    if (!event) return
    const n = entries.filter((e) => e.eventId === event.id).length
    if (!confirm(`Veranstaltung „${event.name}“ mit ${n} Einträgen löschen? Die Gäste bleiben in der Datenbank, aber ihre Historie für diesen Abend geht verloren.`)) return
    actions.deleteEvent(event.id, entries)
    onClose()
    navigate('/')
  }

  return (
    <Sheet
      title={event ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung'}
      onClose={onClose}
      footer={
        <>
          {event && <button className="btn danger" onClick={remove}>Löschen</button>}
          <button className="btn primary grow" onClick={save}>Speichern</button>
        </>
      }
    >
      <Field label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Saturday Club Night" /></Field>
      <div className="row2">
        <Field label="Datum *"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Beginn"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={useLimit} onChange={(e) => setUseLimit(e.target.checked)} /> Gästelisten-Limit
      </label>
      {useLimit && (
        <Field label="Maximal Personen (inkl. Begleitung)">
          <input type="number" inputMode="numeric" min={1} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        </Field>
      )}
      <label className="toggle">
        <input type="checkbox" checked={useDeadline} onChange={(e) => setUseDeadline(e.target.checked)} /> Deadline für Eintragungen
      </label>
      {useDeadline && (
        <Field label="Liste schließt am">
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      )}
      {err && <p className="error">{err}</p>}
    </Sheet>
  )
}

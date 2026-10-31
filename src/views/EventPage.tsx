import { useMemo, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { actions, useData } from '../data'
import type { Entry, Role } from '../types'
import {
  checkedInPersons,
  currentEvent,
  deadlinePassed,
  entryTotal,
  euro,
  fmtDate,
  fmtDateTime,
  fmtTime,
  isOver,
  matchesSearch,
  payLabel,
  persons,
} from '../logic'
import { Chips, Empty, OfflineBanner, Sheet, SyncBadge, TicketBadge, navigate } from '../ui'
import { EntryForm } from './EntryForm'
import { EventForm } from './Events'
import { ImportSheet } from './ImportSheet'
import { exportEvent } from '../export'

type Filter = 'all' | 'open' | 'in'

export function EventPage({ role, eventId, kasseMode }: { role: Role; eventId?: string; kasseMode?: boolean }) {
  const { events, entries, guestMap, eventMap, ticketTypes } = useData()
  const ev = (eventId && eventMap.get(eventId)) || currentEvent(events)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Entry | 'new' | null>(null)
  const [menu, setMenu] = useState(false)
  const [editEvent, setEditEvent] = useState(false)
  const [importing, setImporting] = useState(false)
  const isAdmin = role === 'admin' && !kasseMode

  const list = useMemo(() => (ev ? entries.filter((e) => e.eventId === ev.id && e.status === 'approved') : []), [entries, ev])
  const sorted = useMemo(
    () =>
      [...list].sort((a, b) => {
        const ga = guestMap.get(a.guestId)
        const gb = guestMap.get(b.guestId)
        return (ga?.lastName ?? '').localeCompare(gb?.lastName ?? '', 'de') || (ga?.firstName ?? '').localeCompare(gb?.firstName ?? '', 'de')
      }),
    [list, guestMap],
  )
  const total = list.reduce((s, e) => s + persons(e), 0)
  const inside = list.reduce((s, e) => s + checkedInPersons(e), 0)
  const shown = sorted.filter((e) => {
    if (filter === 'open' && checkedInPersons(e) === persons(e)) return false
    if (filter === 'in' && checkedInPersons(e) === 0) return false
    return matchesSearch(guestMap.get(e.guestId), q)
  })
  // Personen pro Ticketart (Hauptgast und Begleitungen einzeln gezählt)
  const perTicket = useMemo(() => {
    const m = new Map<string, { listed: number; came: number }>()
    const add = (id: string, at: number | null | undefined) => {
      const v = m.get(id) ?? { listed: 0, came: 0 }
      v.listed++
      if (at) v.came++
      m.set(id, v)
    }
    list.forEach((e) => {
      add(e.ticketTypeId, e.checkedInAt)
      e.plus.forEach((p) => add(p.ticketTypeId, p.checkedInAt))
    })
    return ticketTypes.filter((t) => m.has(t.id) || !t.archived).map((t) => ({ tt: t, ...(m.get(t.id) ?? { listed: 0, came: 0 }) }))
  }, [list, ticketTypes])
  const openCount = list.filter((e) => checkedInPersons(e) < persons(e)).length
  const inCount = list.filter((e) => checkedInPersons(e) > 0).length

  if (!ev) {
    return (
      <div className="page-pad">
        <Header role={role} />
        <Empty>
          Noch keine Veranstaltung angelegt.
          {role === 'admin' && <button className="btn primary" onClick={() => navigate('/')}>Veranstaltung anlegen</button>}
        </Empty>
      </div>
    )
  }

  return (
    <div className="event-page">
      <div className="topbar">
        {role === 'admin' ? (
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Zurück">‹</button>
        ) : null}
        <div className="topbar-title">
          {role === 'kasse' || kasseMode ? (
            <select className="event-select" value={ev.id} onChange={(e) => navigate(`/kasse/${e.target.value}`)}>
              {kasseEvents(events).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {fmtDate(x.date)}
                </option>
              ))}
            </select>
          ) : (
            <>
              <h1>{ev.name}</h1>
              <div className="muted small">{fmtDate(ev.date)}{ev.time ? ` · ${ev.time} Uhr` : ''}</div>
            </>
          )}
        </div>
        <SyncBadge />
        {isAdmin ? (
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Menü">⋯</button>
        ) : role === 'kasse' ? (
          <button className="text-btn" onClick={() => confirm('Kasse abmelden?') && signOut(auth)}>Abmelden</button>
        ) : null}
      </div>

      <OfflineBanner />
      <div className="counter">
        <div>
          <b>{inside}</b> / {total} {ev.limit ? <span className="muted">(Limit {ev.limit})</span> : null}
          <span className="muted"> Personen da</span>
        </div>
        <div className="bar"><span style={{ width: total ? `${(inside / total) * 100}%` : 0 }} /></div>
        {total > 0 && (
          <div className="per-ticket">
            {perTicket.map(({ tt, listed, came }) => (
              <div key={tt.id} className="per-ticket-row">
                <TicketBadge tt={tt} />
                <span>
                  <b>{listed}</b> {listed === 1 ? 'Person' : 'Personen'}
                  <span className="muted"> · {came} da</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {isAdmin && ev.deadline && (
          <div className={'small ' + (deadlinePassed(ev) ? 'warn' : 'muted')}>
            Deadline {fmtDateTime(new Date(ev.deadline).getTime())}{deadlinePassed(ev) ? ' · abgelaufen' : ''}
          </div>
        )}
      </div>

      <div className="search-wrap">
        <input
          className="search"
          type="search"
          inputMode="search"
          placeholder="Name oder Instagram suchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {q && <button className="clear" onClick={() => setQ('')} aria-label="Suche leeren">✕</button>}
      </div>
      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `Alle ${list.length}` },
          { value: 'open', label: `Offen ${openCount}` },
          { value: 'in', label: `Da ${inCount}` },
        ]}
      />

      <div className="list">
        {shown.map((e) => (
          <EntryCard key={e.id} entry={e} role={role} canEdit={isAdmin} onEdit={() => setEditing(e)} />
        ))}
        {shown.length === 0 && <Empty>{q ? `Niemand gefunden für „${q}“.` : 'Noch niemand auf der Liste.'}</Empty>}
      </div>

      {isAdmin && (
        <button className="fab" onClick={() => setEditing('new')}>+ Gast eintragen</button>
      )}

      {editing && (
        <EntryForm eventId={ev.id} entry={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      {menu && (
        <Sheet title={ev.name} onClose={() => setMenu(false)}>
          <div className="menu">
            <button onClick={() => navigate(`/event/${ev.id}/dashboard`)}>📊 Dashboard / Anwesenheit</button>
            <button onClick={() => (setMenu(false), setImporting(true))}>↺ Gäste aus anderer Veranstaltung übernehmen</button>
            <button onClick={() => (setMenu(false), exportEvent(ev.id))}>⬇︎ Als Excel exportieren</button>
            <button onClick={() => navigate(`/kasse/${ev.id}`)}>👁 Kassenansicht öffnen</button>
            <button onClick={() => (setMenu(false), setEditEvent(true))}>✎ Veranstaltung bearbeiten</button>
          </div>
        </Sheet>
      )}
      {editEvent && <EventForm event={ev} onClose={() => setEditEvent(false)} />}
      {importing && <ImportSheet targetId={ev.id} onClose={() => setImporting(false)} />}
    </div>
  )
}

function kasseEvents(events: ReturnType<typeof useData>['events']) {
  const upcoming = events.filter((e) => !isOver(e)).sort((a, b) => a.date.localeCompare(b.date))
  const past = events.filter((e) => isOver(e)).slice(0, 5)
  return [...upcoming, ...past]
}

function Header({ role }: { role: Role }) {
  return (
    <div className="topbar">
      <div className="topbar-title"><h1>Gästeliste</h1></div>
      <SyncBadge />
      {role === 'kasse' && <button className="text-btn" onClick={() => signOut(auth)}>Abmelden</button>}
    </div>
  )
}

function EntryCard({ entry: e, role, canEdit, onEdit }: { entry: Entry; role: Role; canEdit: boolean; onEdit: () => void }) {
  const { guestMap, ttMap, stats } = useData()
  const [open, setOpen] = useState(false)
  const g = guestMap.get(e.guestId)
  const st = stats.get(e.guestId)
  const tt = ttMap.get(e.ticketTypeId)
  const n = persons(e)
  const inN = checkedInPersons(e)
  const allIn = inN === n
  const toPay = entryTotal(e, ttMap)
  const by = role === 'admin' ? 'Admin' : 'Kasse'

  const checkAll = () => {
    const now = Date.now()
    actions.setCheckIn(e, e.checkedInAt ?? now, e.plus.map((p) => p.checkedInAt ?? now), by)
  }
  const toggleMain = () => actions.setCheckIn(e, e.checkedInAt ? null : Date.now(), e.plus.map((p) => p.checkedInAt ?? null), by)
  const togglePlus = (i: number) =>
    actions.setCheckIn(
      e,
      e.checkedInAt,
      e.plus.map((p, j) => (j === i ? (p.checkedInAt ? null : Date.now()) : p.checkedInAt ?? null)),
      by,
    )

  return (
    <div className={'card entry' + (allIn ? ' done' : inN ? ' partial' : '')}>
      <div className="entry-main" onClick={() => setOpen(!open)}>
        <div className="entry-info">
          <div className="name">
            {g ? (
              <>
                <span className="last">{g.lastName}</span>, {g.firstName}
              </>
            ) : (
              'Unbekannter Gast'
            )}
          </div>
          <div className="badges">
            <TicketBadge tt={tt} />
            {e.plus.map((p, i) => (
              <TicketBadge key={i} tt={ttMap.get(p.ticketTypeId)} prefix="+1 " />
            ))}
          </div>
          {toPay > 0 && <div className="pay">💶 Kassieren: <b>{euro(toPay)}</b></div>}
          {st && st.noShows > 0 && (
            <div className="noshow">⚠ {st.noShows}× nicht gekommen{st.came ? ` · ${st.came}× da` : ''}</div>
          )}
          {e.note && <div className="note">„{e.note}“</div>}
        </div>
        <div className="entry-action" onClick={(x) => x.stopPropagation()}>
          {inN === 0 ? (
            <button className="checkin" onClick={checkAll}>
              Einchecken{n > 1 ? <small>{n} Pers.</small> : null}
            </button>
          ) : (
            <button className={'checked' + (allIn ? '' : ' part')} onClick={() => setOpen(!open)}>
              ✓ {e.checkedInAt ? fmtTime(e.checkedInAt) : ''}
              {n > 1 ? <small>{inN}/{n} da</small> : null}
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="entry-detail">
          {g?.instagram && <div>📷 <a href={`https://instagram.com/${g.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">@{g.instagram.replace(/^@/, '')}</a></div>}
          {g?.phone && <div>📞 <a href={`tel:${g.phone}`}>{g.phone}</a></div>}
          {g?.note && <div className="muted">Info: {g.note}</div>}
          <div className="muted small">Eingetragen von {e.addedBy || '–'}</div>
          <div className="persons">
            <PersonRow label={g ? g.firstName : 'Gast'} sub={[tt?.name, payLabel(tt, e.pay)].filter(Boolean).join(' · ')} at={e.checkedInAt} onToggle={toggleMain} />
            {e.plus.map((p, i) => {
              const ptt = ttMap.get(p.ticketTypeId)
              return (
                <PersonRow
                  key={i}
                  label={`Begleitung ${i + 1}`}
                  sub={[ptt?.name, payLabel(ptt, p.pay)].filter(Boolean).join(' · ')}
                  at={p.checkedInAt ?? null}
                  onToggle={() => togglePlus(i)}
                />
              )
            })}
          </div>
          {canEdit && <button className="btn" onClick={onEdit}>✎ Bearbeiten</button>}
        </div>
      )}
    </div>
  )
}

function PersonRow({ label, sub, at, onToggle }: { label: string; sub: string; at: number | null; onToggle: () => void }) {
  return (
    <div className="person">
      <div>
        <div>{label}</div>
        <div className="muted small">{sub}</div>
      </div>
      <button
        className={at ? 'mini checked' : 'mini checkin'}
        onClick={() => {
          if (at && !confirm('Check-in rückgängig machen?')) return
          onToggle()
        }}
      >
        {at ? `✓ ${fmtTime(at)}` : 'Einchecken'}
      </button>
    </div>
  )
}

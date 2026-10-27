import { useMemo, useState } from 'react'
import { actions, useData } from '../data'
import { fmtDate, fmtDateTime, fmtTime, isOver, matchesSearch } from '../logic'
import { Chips, Empty, Field, SyncBadge, TicketBadge, navigate } from '../ui'
import { EntryForm } from './EntryForm'
import { exportGuests } from '../export'

type Sort = 'name' | 'noshow' | 'visits'

export function GuestsPage() {
  const { guests, stats } = useData()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const list = useMemo(() => {
    const l = guests.filter((g) => matchesSearch(g, q))
    const st = (id: string) => stats.get(id) ?? { listed: 0, came: 0, noShows: 0, lastVisit: null }
    if (sort === 'noshow') return l.filter((g) => st(g.id).noShows > 0).sort((a, b) => st(b.id).noShows - st(a.id).noShows)
    if (sort === 'visits') return l.sort((a, b) => st(b.id).came - st(a.id).came)
    return l.sort((a, b) => a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de'))
  }, [guests, stats, q, sort])

  return (
    <div className="page-pad">
      <div className="topbar">
        <div className="topbar-title"><h1>Gäste-Datenbank</h1><div className="muted small">{guests.length} Gäste</div></div>
        <SyncBadge />
      </div>
      <div className="search-wrap">
        <input className="search" type="search" placeholder="Gast suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="clear" onClick={() => setQ('')} aria-label="Suche leeren">✕</button>}
      </div>
      <Chips<Sort>
        value={sort}
        onChange={setSort}
        options={[
          { value: 'name', label: 'A–Z' },
          { value: 'visits', label: 'Häufigste' },
          { value: 'noshow', label: '⚠ No-Shows' },
        ]}
      />
      <button className="btn" onClick={() => exportGuests()}>⬇︎ Datenbank als Excel</button>
      <div className="list">
        {list.map((g) => {
          const s = stats.get(g.id)
          return (
            <button key={g.id} className="card guest-row" onClick={() => navigate(`/guest/${g.id}`)}>
              <div>
                <div className="name"><span className="last">{g.lastName}</span>, {g.firstName}</div>
                {g.instagram && <div className="muted small">@{g.instagram}</div>}
              </div>
              <div className="guest-stats">
                <span className="ok">{s?.came ?? 0}× da</span>
                {s && s.noShows > 0 && <span className="warn">⚠ {s.noShows}× No-Show</span>}
              </div>
            </button>
          )
        })}
        {!list.length && <Empty>{sort === 'noshow' ? 'Keine No-Shows bisher.' : 'Keine Gäste gefunden.'}</Empty>}
      </div>
    </div>
  )
}

export function GuestPage({ guestId }: { guestId: string }) {
  const { guestMap, entries, eventMap, ttMap, stats } = useData()
  const g = guestMap.get(guestId)
  const [adding, setAdding] = useState(false)
  const [edit, setEdit] = useState(false)
  if (!g) return <div className="page-pad"><Empty>Gast nicht gefunden.</Empty></div>
  const s = stats.get(g.id) ?? { listed: 0, came: 0, noShows: 0, lastVisit: null }
  const history = entries
    .filter((e) => e.guestId === g.id)
    .map((e) => ({ e, ev: eventMap.get(e.eventId) }))
    .filter((x) => x.ev)
    .sort((a, b) => b.ev!.date.localeCompare(a.ev!.date))
  const rate = s.listed ? Math.round((s.came / s.listed) * 100) : null

  return (
    <div className="page-pad">
      <div className="topbar">
        <button className="icon-btn" onClick={() => navigate("/guests")} aria-label="Zurück">‹</button>
        <div className="topbar-title"><h1>{g.firstName} {g.lastName}</h1></div>
      </div>
      <div className="tiles">
        <div className="tile"><b>{s.came}</b><span>da</span></div>
        <div className={'tile' + (s.noShows ? ' warn' : '')}><b>{s.noShows}</b><span>No-Shows</span></div>
        <div className="tile"><b>{rate === null ? '–' : `${rate} %`}</b><span>Zuverlässigkeit</span></div>
      </div>
      {s.lastVisit && <p className="muted small">Zuletzt da: {fmtDateTime(s.lastVisit)}</p>}
      {edit ? <GuestEdit guestId={g.id} onDone={() => setEdit(false)} /> : (
        <div className="card">
          {g.phone && <div>📞 <a href={`tel:${g.phone}`}>{g.phone}</a></div>}
          {g.instagram && <div>📷 <a href={`https://instagram.com/${g.instagram}`} target="_blank" rel="noreferrer">@{g.instagram}</a></div>}
          {g.note && <div className="muted">Info: {g.note}</div>}
          {!g.phone && !g.instagram && !g.note && <div className="muted">Keine weiteren Infos.</div>}
          <button className="btn" onClick={() => setEdit(true)}>✎ Bearbeiten</button>
        </div>
      )}
      <button className="btn primary big" onClick={() => setAdding(true)}>+ Auf eine Gästeliste setzen</button>
      <h3>Verlauf</h3>
      {history.map(({ e, ev }) => (
        <div key={e.id} className="card history" onClick={() => navigate(`/event/${ev!.id}`)}>
          <div>
            <div className="name">{ev!.name}</div>
            <div className="muted small">{fmtDate(ev!.date)} · von {e.addedBy || '–'}</div>
            <div className="badges">
              <TicketBadge tt={ttMap.get(e.ticketTypeId)} />
              {e.plus.map((p, i) => <TicketBadge key={i} tt={ttMap.get(p.ticketTypeId)} prefix="+1 " />)}
            </div>
          </div>
          <div>
            {e.checkedInAt ? <span className="ok">✓ {fmtTime(e.checkedInAt)}</span> : isOver(ev!) ? <span className="warn">No-Show</span> : <span className="muted">offen</span>}
          </div>
        </div>
      ))}
      {!history.length && <Empty>Noch auf keiner Liste.</Empty>}
      {adding && <EntryForm presetGuestId={g.id} onClose={() => setAdding(false)} />}
    </div>
  )
}

function GuestEdit({ guestId, onDone }: { guestId: string; onDone: () => void }) {
  const { guestMap, entries } = useData()
  const g = guestMap.get(guestId)!
  const [v, setV] = useState({ firstName: g.firstName, lastName: g.lastName, phone: g.phone ?? '', instagram: g.instagram ?? '', note: g.note ?? '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })
  const save = () => {
    if (!v.firstName.trim() || !v.lastName.trim()) return alert('Vorname und Nachname sind Pflicht.')
    actions.saveGuest({
      ...g,
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      phone: v.phone.trim() || undefined,
      instagram: v.instagram.trim().replace(/^@/, '') || undefined,
      note: v.note.trim() || undefined,
    })
    onDone()
  }
  const remove = () => {
    if (!confirm(`${g.firstName} ${g.lastName} komplett löschen, inklusive aller Einträge und Historie?`)) return
    actions.deleteGuest(g.id, entries)
    navigate('/guests')
  }
  return (
    <div className="card">
      <div className="row2">
        <Field label="Vorname *"><input value={v.firstName} onChange={set('firstName')} /></Field>
        <Field label="Nachname *"><input value={v.lastName} onChange={set('lastName')} /></Field>
      </div>
      <div className="row2">
        <Field label="Telefon"><input type="tel" value={v.phone} onChange={set('phone')} /></Field>
        <Field label="Instagram"><input value={v.instagram} onChange={set('instagram')} /></Field>
      </div>
      <Field label="Dauerhafte Info (sieht auch die Kasse)"><textarea rows={2} value={v.note} onChange={set('note')} /></Field>
      <div className="btn-row">
        <button className="btn danger" onClick={remove}>Löschen</button>
        <button className="btn" onClick={onDone}>Abbrechen</button>
        <button className="btn primary grow" onClick={save}>Speichern</button>
      </div>
    </div>
  )
}

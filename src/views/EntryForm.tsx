import { useMemo, useState } from 'react'
import { actions, useData } from '../data'
import type { Entry, Guest, Pay, PlusPerson, TicketType } from '../types'
import { deadlinePassed, euro, fmtDate, isOver, normalize, persons, priceFor } from '../logic'
import { Chips, Field, Sheet } from '../ui'

const LAST_BY = 'gl.lastAddedBy'
const getLastBy = () => {
  try {
    return localStorage.getItem(LAST_BY) || ''
  } catch {
    return ''
  }
}

export function EntryForm({ eventId, entry, presetGuestId, onClose }: { eventId?: string; entry?: Entry; presetGuestId?: string; onClose: () => void }) {
  const { guests, guestMap, ticketTypes, ttMap, stats, entries, events, eventMap, settings } = useData()
  const activeTT = ticketTypes.filter((t) => !t.archived || t.id === entry?.ticketTypeId)
  const initialGuest = guestMap.get(entry?.guestId ?? presetGuestId ?? '')
  const [evId, setEvId] = useState(eventId ?? events.filter((e) => !isOver(e)).sort((a, b) => a.date.localeCompare(b.date))[0]?.id ?? '')
  const [guestId, setGuestId] = useState<string | null>(initialGuest?.id ?? null)
  const [firstName, setFirst] = useState(initialGuest?.firstName ?? '')
  const [lastName, setLast] = useState(initialGuest?.lastName ?? '')
  const [phone, setPhone] = useState(initialGuest?.phone ?? '')
  const [instagram, setInsta] = useState(initialGuest?.instagram ?? '')
  const [ticketTypeId, setTT] = useState(entry?.ticketTypeId ?? activeTT[0]?.id ?? '')
  const [pay, setPay] = useState<Pay | undefined>(entry?.pay)
  const [plus, setPlus] = useState<PlusPerson[]>(entry?.plus ?? [])
  const [note, setNote] = useState(entry?.note ?? '')
  const [addedBy, setAddedBy] = useState(entry?.addedBy ?? getLastBy())
  const [err, setErr] = useState('')

  const byNames = useMemo(() => {
    const s = new Set<string>(settings.addedByNames ?? [])
    entries.forEach((e) => e.addedBy && s.add(e.addedBy))
    return [...s].sort()
  }, [entries, settings])

  // Vorschläge aus der Gäste-Datenbank, solange kein bestehender Gast gewählt ist.
  const suggestions = useMemo(() => {
    if (guestId) return []
    const q = normalize(`${firstName} ${lastName}`)
    if (q.length < 2) return []
    const toks = q.split(' ')
    return guests
      .filter((g) => {
        const hay = normalize(`${g.firstName} ${g.lastName} ${g.instagram ?? ''}`)
        return toks.every((t) => hay.includes(t))
      })
      .slice(0, 5)
  }, [guests, firstName, lastName, guestId])

  const pickGuest = (g: Guest) => {
    setGuestId(g.id)
    setFirst(g.firstName)
    setLast(g.lastName)
    setPhone(g.phone ?? '')
    setInsta(g.instagram ?? '')
  }

  const save = async () => {
    setErr('')
    const f = firstName.trim()
    const l = lastName.trim()
    if (!f || !l) return setErr('Vorname und Nachname sind Pflicht.')
    if (!evId) return setErr('Bitte eine Veranstaltung wählen.')
    const ev = eventMap.get(evId)!

    let gid = guestId
    if (!gid) {
      const same = guests.find((g) => normalize(g.firstName) === normalize(f) && normalize(g.lastName) === normalize(l))
      if (same && confirm(`${f} ${l} gibt es schon in der Gäste-Datenbank. Ist das dieselbe Person?`)) gid = same.id
    }
    if (entries.some((e) => e.eventId === evId && e.guestId === gid && e.id !== entry?.id)) {
      return setErr(`${f} ${l} steht bei dieser Veranstaltung schon auf der Liste.`)
    }
    const newPersons = 1 + plus.length
    if (!entry && ev.limit) {
      const count = entries.filter((e) => e.eventId === evId && e.status === 'approved').reduce((s, e) => s + persons(e), 0)
      if (count + newPersons > ev.limit && !confirm(`Limit von ${ev.limit} Personen wäre überschritten (${count + newPersons}). Trotzdem eintragen?`)) return
    }
    if (!entry && deadlinePassed(ev) && !confirm('Die Deadline für diese Liste ist abgelaufen. Trotzdem eintragen?')) return

    const old = gid ? guestMap.get(gid) : undefined
    const g: Guest = {
      id: gid ?? actions.newId('guests'),
      firstName: f,
      lastName: l,
      phone: phone.trim() || undefined,
      instagram: instagram.trim().replace(/^@/, '') || undefined,
      note: old?.note,
      createdAt: old?.createdAt ?? Date.now(),
    }
    const tt = ttMap.get(ticketTypeId)
    const e: Entry = {
      id: entry?.id ?? actions.newId('entries'),
      eventId: evId,
      guestId: g.id,
      ticketTypeId,
      pay: tt?.paid ? pay ?? { mode: 'full' } : undefined,
      plus: plus.map((p) => ({ ...p, pay: ttMap.get(p.ticketTypeId)?.paid ? p.pay ?? { mode: 'full' } : undefined })),
      note: note.trim() || undefined,
      addedBy: addedBy.trim(),
      createdAt: entry?.createdAt ?? Date.now(),
      createdByEmail: entry?.createdByEmail,
      checkedInAt: entry?.checkedInAt ?? null,
      checkedInBy: entry?.checkedInBy,
      status: entry?.status ?? 'approved',
    }
    try {
      localStorage.setItem(LAST_BY, e.addedBy)
    } catch {
      /* egal */
    }
    // Nicht auf den Server warten: offline wird lokal gespeichert und später synchronisiert.
    actions.saveGuest(g).catch((x) => alert('Fehler beim Speichern: ' + x.message))
    actions.saveEntry(e).catch((x) => alert('Fehler beim Speichern: ' + x.message))
    onClose()
  }

  const remove = () => {
    if (!entry || !confirm('Diesen Eintrag von der Liste löschen? Der Gast bleibt in der Datenbank.')) return
    actions.deleteEntry(entry.id)
    onClose()
  }

  const st = guestId ? stats.get(guestId) : undefined
  const total = priceFor(ttMap.get(ticketTypeId), pay) + plus.reduce((s, p) => s + priceFor(ttMap.get(p.ticketTypeId), p.pay), 0)

  return (
    <Sheet
      title={entry ? 'Eintrag bearbeiten' : 'Gast eintragen'}
      onClose={onClose}
      footer={
        <>
          {entry && <button className="btn danger" onClick={remove}>Löschen</button>}
          <button className="btn primary grow" onClick={save}>Speichern{total > 0 ? ` · ${euro(total)}` : ''}</button>
        </>
      }
    >
      {!eventId && (
        <Field label="Veranstaltung">
          <select value={evId} onChange={(e) => setEvId(e.target.value)}>
            <option value="">– wählen –</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name} · {fmtDate(e.date)}</option>
            ))}
          </select>
        </Field>
      )}
      <div className="row2">
        <Field label="Vorname *">
          <input value={firstName} onChange={(e) => (setFirst(e.target.value), !entry && setGuestId(null))} autoCapitalize="words" autoComplete="off" />
        </Field>
        <Field label="Nachname *">
          <input value={lastName} onChange={(e) => (setLast(e.target.value), !entry && setGuestId(null))} autoCapitalize="words" autoComplete="off" />
        </Field>
      </div>
      {suggestions.length > 0 && (
        <div className="suggest">
          <div className="muted small">Schon in der Datenbank:</div>
          {suggestions.map((g) => {
            const s = stats.get(g.id)
            return (
              <button key={g.id} type="button" onClick={() => pickGuest(g)}>
                <b>{g.firstName} {g.lastName}</b>
                {g.instagram ? <span className="muted"> @{g.instagram}</span> : null}
                {s && s.listed > 0 ? <span className={s.noShows ? 'warn' : 'muted'}> · {s.came}× da, {s.noShows}× No-Show</span> : null}
              </button>
            )
          })}
        </div>
      )}
      {guestId && st && st.noShows > 0 && (
        <div className="noshow box">⚠ Achtung: {st.noShows}× nicht gekommen, {st.came}× da.</div>
      )}
      {guestId && !entry && <div className="muted small">Bestehender Gast aus der Datenbank. <button className="link" type="button" onClick={() => setGuestId(null)}>Doch neuer Gast</button></div>}
      <div className="row2">
        <Field label="Telefon">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Instagram">
          <input value={instagram} onChange={(e) => setInsta(e.target.value)} placeholder="@name" autoCapitalize="none" autoCorrect="off" />
        </Field>
      </div>

      <Field label="Ticketart">
        <TicketPicker types={activeTT} value={ticketTypeId} onChange={(id) => (setTT(id), setPay(undefined))} />
      </Field>
      <PayEditor tt={ttMap.get(ticketTypeId)} pay={pay} onChange={setPay} />

      <div className="field">
        <span className="field-label">Begleitung (Plus)</span>
        {plus.map((p, i) => (
          <div key={i} className="plus-row">
            <div className="plus-head">
              <b>+{i + 1}</b>
              <button type="button" className="link danger" onClick={() => setPlus(plus.filter((_, j) => j !== i))}>entfernen</button>
            </div>
            <TicketPicker types={activeTT} value={p.ticketTypeId} onChange={(id) => setPlus(plus.map((x, j) => (j === i ? { ...x, ticketTypeId: id, pay: undefined } : x)))} />
            <PayEditor tt={ttMap.get(p.ticketTypeId)} pay={p.pay} onChange={(pay) => setPlus(plus.map((x, j) => (j === i ? { ...x, pay } : x)))} />
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setPlus([...plus, { ticketTypeId: activeTT[0]?.id ?? '', checkedInAt: null }])}>+ Begleitung hinzufügen</button>
      </div>

      <Field label="Eingetragen von / über" hint="z. B. du selbst, ein DJ oder Promoter">
        <input list="by-names" value={addedBy} onChange={(e) => setAddedBy(e.target.value)} />
        <datalist id="by-names">{byNames.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <Field label="Notiz für diesen Abend">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {err && <p className="error">{err}</p>}
    </Sheet>
  )
}

function TicketPicker({ types, value, onChange }: { types: TicketType[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="chips">
      {types.map((t) => (
        <button type="button" key={t.id} className={'chip tt' + (t.id === value ? ' on' : '')} style={{ ['--c' as string]: t.color }} onClick={() => onChange(t.id)}>
          {t.name}
        </button>
      ))}
    </div>
  )
}

function PayEditor({ tt, pay, onChange }: { tt?: TicketType; pay?: Pay; onChange: (p: Pay) => void }) {
  if (!tt?.paid) return null
  const p: Pay = pay ?? { mode: 'full' }
  return (
    <div className="pay-editor">
      <Chips<'full' | 'discount'>
        value={p.mode}
        onChange={(mode) => onChange(mode === 'full' ? { mode } : { mode, discountKind: p.discountKind ?? 'percent', discountValue: p.discountValue ?? 50 })}
        options={[
          { value: 'full', label: `Vollpreis ${euro(tt.defaultPrice)}` },
          { value: 'discount', label: 'Rabatt' },
        ]}
      />
      {p.mode === 'discount' && (
        <div className="discount">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={p.discountValue ?? ''}
            onChange={(e) => onChange({ ...p, discountValue: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <Chips<'percent' | 'price'>
            value={p.discountKind ?? 'percent'}
            onChange={(discountKind) => onChange({ ...p, discountKind })}
            options={[
              { value: 'percent', label: '% Rabatt' },
              { value: 'price', label: '€ Endpreis' },
            ]}
          />
          <span className="muted">= {euro(priceFor(tt, p))}</span>
        </div>
      )}
    </div>
  )
}

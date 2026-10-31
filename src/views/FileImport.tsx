import { useMemo, useState } from 'react'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { actions, useData } from '../data'
import { normalize } from '../logic'
import { Sheet } from '../ui'

type Row = { lastName: string; firstName: string; phone?: string; persons: number; source?: string }
type ImportFile = { format: string; ticketTypeName: string; addedBy: string; rows: Row[] }

const COLOR = '#4cc9f0'

// Importiert eine vorbereitete Gästeliste-Datei in eine Veranstaltung.
// Fügt ausschließlich neue Dokumente hinzu; bestehende Gäste und Einträge werden nie verändert oder gelöscht.
export function FileImport({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { guests, entries, ticketTypes, eventMap } = useData()
  const ev = eventMap.get(eventId)!
  const [file, setFile] = useState<ImportFile | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const load = async (f?: File) => {
    setErr('')
    if (!f) return
    try {
      const data = JSON.parse(await f.text()) as ImportFile
      if (data.format !== 'gaesteliste-import-v1' || !Array.isArray(data.rows)) throw new Error()
      setFile(data)
    } catch {
      setErr('Diese Datei kann nicht gelesen werden.')
    }
  }

  const plan = useMemo(() => {
    if (!file) return null
    const key = (f: string, l: string) => `${normalize(f)}|${normalize(l)}`
    const guestByName = new Map(guests.map((g) => [key(g.firstName, g.lastName), g]))
    const onList = new Set(entries.filter((e) => e.eventId === eventId).map((e) => e.guestId))
    const tt = ticketTypes.find((t) => normalize(t.name) === normalize(file.ticketTypeName))
    const seen = new Set<string>()
    const rows = file.rows.map((r) => {
      const k = key(r.firstName, r.lastName)
      const existing = guestByName.get(k)
      const dup = (existing && onList.has(existing.id)) || seen.has(k)
      seen.add(k)
      return { ...r, existing, skip: !!dup }
    })
    const add = rows.filter((r) => !r.skip)
    return { tt, rows, add, persons: add.reduce((s, r) => s + r.persons, 0) }
  }, [file, guests, entries, ticketTypes, eventId])

  const run = async () => {
    if (!file || !plan || !plan.add.length) return
    if (!confirm(`${plan.add.length} Einträge mit ${plan.persons} Personen in „${ev.name}“ importieren?`)) return
    setBusy(true)
    const b = writeBatch(db)
    let ttId = plan.tt?.id
    if (!ttId) {
      ttId = actions.newId('ticketTypes')
      b.set(doc(db, 'ticketTypes', ttId), {
        name: file.ticketTypeName,
        color: COLOR,
        paid: false,
        defaultPrice: 0,
        order: Math.max(0, ...ticketTypes.map((t) => t.order)) + 1,
        archived: false,
      })
    }
    const now = Date.now()
    plan.add.forEach((r, i) => {
      let guestId = r.existing?.id
      if (!guestId) {
        guestId = actions.newId('guests')
        b.set(doc(db, 'guests', guestId), {
          firstName: r.firstName,
          lastName: r.lastName,
          ...(r.phone ? { phone: r.phone } : {}),
          createdAt: now + i,
        })
      }
      b.set(doc(db, 'entries', actions.newId('entries')), {
        eventId,
        guestId,
        ticketTypeId: ttId,
        plus: Array.from({ length: r.persons - 1 }, () => ({ ticketTypeId: ttId, checkedInAt: null })),
        addedBy: file.addedBy,
        createdAt: now + i,
        checkedInAt: null,
        status: 'approved',
      })
    })
    try {
      const msg = `${plan.add.length} Einträge mit ${plan.persons} Personen importiert.`
      if (navigator.onLine) {
        // Wartet auf die Bestätigung vom Server; alles oder nichts.
        await b.commit()
        setDone(msg)
      } else {
        b.commit().catch((e) => alert('Import fehlgeschlagen: ' + e.message))
        setDone(msg + ' Kein Internet: wird übertragen, sobald wieder Netz da ist.')
      }
    } catch (e) {
      setErr('Import fehlgeschlagen: ' + (e as Error).message)
    }
    setBusy(false)
  }

  return (
    <Sheet
      title="Liste aus Datei importieren"
      onClose={onClose}
      footer={
        done ? (
          <button className="btn primary grow" onClick={onClose}>Fertig</button>
        ) : (
          <button className="btn primary grow" disabled={!plan?.add.length || busy} onClick={run}>
            {plan ? `${plan.add.length} Einträge (${plan.persons} Pers.) importieren` : 'Importieren'}
          </button>
        )
      }
    >
      {done ? (
        <p className="ok">✓ {done}</p>
      ) : (
        <>
          <p className="muted small">Ziel: <b>{ev.name}</b>. Bestehende Gäste und Einträge werden nicht verändert. Wer schon auf dieser Liste steht, wird übersprungen.</p>
          <input type="file" accept=".json,application/json" onChange={(e) => load(e.target.files?.[0])} />
          {err && <p className="error">{err}</p>}
          {plan && file && (
            <>
              <div className="card">
                <div>Ticketart: <b>{file.ticketTypeName}</b> {plan.tt ? '(vorhanden)' : '(wird neu angelegt)'}</div>
                <div>Eingetragen von: <b>{file.addedBy}</b></div>
                <div>Neu: <b>{plan.add.length}</b> Einträge, <b>{plan.persons}</b> Personen</div>
                {plan.rows.length !== plan.add.length && <div className="warn">Übersprungen (schon auf der Liste): {plan.rows.length - plan.add.length}</div>}
              </div>
              {plan.rows.map((r, i) => (
                <div key={i} className={'check-row' + (r.skip ? ' muted' : '')}>
                  <span>
                    <b>{r.lastName}</b>, {r.firstName}
                    {r.persons > 1 ? ` +${r.persons - 1}` : ''}
                    <span className="muted small"> · {r.persons} Pers.</span>
                  </span>
                  {r.skip ? <span className="small">übersprungen</span> : r.existing ? <span className="small muted">bekannter Gast</span> : null}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Sheet>
  )
}

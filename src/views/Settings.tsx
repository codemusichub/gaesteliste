import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { actions, useData } from '../data'
import type { TicketType } from '../types'
import { euro } from '../logic'
import { Field, Sheet, SyncBadge, TicketBadge } from '../ui'

const COLORS = ['#3ddc97', '#ffb547', '#c08bff', '#4cc9f0', '#ff6b8b', '#f2f2f5', '#ffd23f', '#7d8cff']

export function SettingsPage() {
  const { ticketTypes, settings, events, entries, guests } = useData()
  const [edit, setEdit] = useState<TicketType | 'new' | null>(null)
  const [names, setNames] = useState((settings.addedByNames ?? []).join(', '))
  const kasseUrl = location.href.split('#')[0] + '#/kasse'

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Kasse Gästeliste', url: kasseUrl })
      else {
        await navigator.clipboard.writeText(kasseUrl)
        alert('Link kopiert')
      }
    } catch {
      /* abgebrochen */
    }
  }

  // Komplett-Backup aller Daten als JSON-Datei (nur lesen, ändert nichts)
  const backup = () => {
    const data = { exportedAt: new Date().toISOString(), events, entries, guests, ticketTypes, settings }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `gaesteliste-backup-${new Date().toISOString().slice(0, 16).replace(':', '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  return (
    <div className="page-pad">
      <div className="topbar">
        <div className="topbar-title"><h1>Einstellungen</h1></div>
        <SyncBadge />
      </div>

      <h3>Datensicherung</h3>
      <div className="card">
        <p className="muted small">Speichert alle Veranstaltungen, Gäste und Einträge als Datei auf diesem Gerät. Daraus lässt sich im Notfall alles wiederherstellen.</p>
        <p className="small">{events.length} Veranstaltungen · {guests.length} Gäste · {entries.length} Einträge</p>
        <button className="btn primary" onClick={backup}>💾 Komplett-Backup herunterladen</button>
      </div>

      <h3>Kassen-Zugang</h3>
      <div className="card">
        <div className="small break">{kasseUrl}</div>
        <p className="muted small">Link an die Kasse schicken. Dort mit der PIN anmelden und die Seite zum Home-Bildschirm hinzufügen. Die PIN änderst du in Firebase unter Authentication beim Nutzer {''}„kasse@…“.</p>
        <button className="btn" onClick={share}>Link teilen</button>
      </div>

      <h3>Ticketarten</h3>
      <div className="card">
        {ticketTypes.map((t) => (
          <button key={t.id} className="tt-row" onClick={() => setEdit(t)}>
            <TicketBadge tt={t} />
            <span className="muted small">{t.paid ? euro(t.defaultPrice) : 'kostenlos'}{t.archived ? ' · ausgeblendet' : ''}</span>
          </button>
        ))}
        <button className="btn" onClick={() => setEdit('new')}>+ Neue Ticketart</button>
      </div>

      <h3>„Eingetragen von“-Namen</h3>
      <div className="card">
        <Field label="Vorschläge beim Eintragen (mit Komma getrennt)" hint="z. B. Denis, DJ Max, Promoter Lisa">
          <input value={names} onChange={(e) => setNames(e.target.value)} />
        </Field>
        <button className="btn" onClick={() => actions.saveSettings({ addedByNames: names.split(',').map((s) => s.trim()).filter(Boolean) })}>Speichern</button>
      </div>

      <button className="btn danger big" onClick={() => confirm('Abmelden?') && signOut(auth)}>Abmelden</button>
      {edit && <TicketForm tt={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function TicketForm({ tt, onClose }: { tt?: TicketType; onClose: () => void }) {
  const { ticketTypes } = useData()
  const [name, setName] = useState(tt?.name ?? '')
  const [color, setColor] = useState(tt?.color ?? COLORS[ticketTypes.length % COLORS.length])
  const [paid, setPaid] = useState(tt?.paid ?? false)
  const [price, setPrice] = useState(tt?.defaultPrice ?? 0)
  const save = (archived = tt?.archived ?? false) => {
    if (!name.trim()) return alert('Name fehlt')
    actions.saveTicketType({
      id: tt?.id ?? actions.newId('ticketTypes'),
      name: name.trim(),
      color,
      paid,
      defaultPrice: paid ? Number(price) || 0 : 0,
      order: tt?.order ?? Math.max(0, ...ticketTypes.map((t) => t.order)) + 1,
      archived,
    })
    onClose()
  }
  return (
    <Sheet
      title={tt ? 'Ticketart bearbeiten' : 'Neue Ticketart'}
      onClose={onClose}
      footer={
        <>
          {tt && <button className="btn" onClick={() => save(!tt.archived)}>{tt.archived ? 'Wieder einblenden' : 'Ausblenden'}</button>}
          <button className="btn primary grow" onClick={() => save()}>Speichern</button>
        </>
      }
    >
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Backstage" /></Field>
      <div className="field">
        <span className="field-label">Farbe</span>
        <div className="chips">
          {COLORS.map((c) => (
            <button key={c} type="button" className={'swatch' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </div>
      <label className="toggle"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Muss bezahlen</label>
      {paid && (
        <Field label="Vollpreis (€)"><input type="number" inputMode="decimal" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></Field>
      )}
      <p className="muted small">Ausgeblendete Ticketarten bleiben bei alten Einträgen erhalten, stehen aber beim Eintragen nicht mehr zur Auswahl.</p>
    </Sheet>
  )
}

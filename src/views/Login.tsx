import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { KASSE_EMAIL } from '../config'

export function AdminLogin() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw)
    } catch {
      setErr('Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.')
    }
    setBusy(false)
  }
  return (
    <form className="login" onSubmit={submit}>
      <div className="logo">Gästeliste</div>
      <p className="muted">Admin-Anmeldung</p>
      <input type="email" autoComplete="username" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" autoComplete="current-password" placeholder="Passwort" value={pw} onChange={(e) => setPw(e.target.value)} required />
      {err && <p className="error">{err}</p>}
      <button className="btn primary big" disabled={busy}>Anmelden</button>
      <a className="link" href="#/kasse">Zur Kasse</a>
    </form>
  )
}

export function KasseLogin() {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const tryLogin = async (p: string) => {
    setBusy(true)
    setErr('')
    try {
      await signInWithEmailAndPassword(auth, KASSE_EMAIL, p)
    } catch {
      setErr(navigator.onLine ? 'Falsche PIN' : 'Für die erste Anmeldung wird Internet gebraucht.')
      setPin('')
    }
    setBusy(false)
  }
  const press = (d: string) => {
    if (busy) return
    const next = (pin + d).slice(0, 6)
    setPin(next)
    if (next.length === 6) tryLogin(next)
  }
  return (
    <div className="login">
      <div className="logo">Kasse</div>
      <p className="muted">PIN eingeben</p>
      <div className="pin-dots">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      {err && <p className="error">{err}</p>}
      <div className="pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button key={i} onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))} disabled={busy}>
              {k}
            </button>
          ),
        )}
      </div>
      <a className="link" href="#/">Admin-Anmeldung</a>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import { ADMIN_EMAILS, KASSE_EMAIL } from './config'
import { DataProvider, useData } from './data'
import type { Role } from './types'
import { AdminLogin, KasseLogin } from './views/Login'
import { EventsPage } from './views/Events'
import { EventPage } from './views/EventPage'
import { Dashboard } from './views/Dashboard'
import { GuestsPage, GuestPage } from './views/Guests'
import { SettingsPage } from './views/Settings'
import { navigate } from './ui'

function useHash() {
  const [hash, setHash] = useState(location.hash.replace(/^#/, '') || '/')
  useEffect(() => {
    const f = () => {
      setHash(location.hash.replace(/^#/, '') || '/')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return hash
}

const roleOf = (u: User | null): Role | null => {
  const email = u?.email?.toLowerCase()
  if (!email) return null
  if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) return 'admin'
  if (email === KASSE_EMAIL.toLowerCase()) return 'kasse'
  return null
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const hash = useHash()
  useEffect(() => onAuthStateChanged(auth, setUser), [])

  if (user === undefined) return <div className="splash">Lädt…</div>
  const role = roleOf(user)
  const wantsKasse = hash.startsWith('/kasse')

  if (user && !role) {
    return (
      <div className="login">
        <p>Dieses Konto hat keinen Zugriff.</p>
        <button className="btn" onClick={() => signOut(auth)}>Abmelden</button>
      </div>
    )
  }
  if (!user) return wantsKasse ? <KasseLogin /> : <AdminLogin />

  return (
    <DataProvider role={role!}>
      <Shell role={role!} hash={hash} />
    </DataProvider>
  )
}

function Shell({ role, hash }: { role: Role; hash: string }) {
  const { ready } = useData()
  if (!ready) return <div className="splash">Lädt Gästeliste…</div>

  if (role === 'kasse') return <EventPage role="kasse" eventId={hash.split('/')[2]} />

  const parts = hash.split('/').filter(Boolean)
  let page
  let tab = 'events'
  if (parts[0] === 'kasse') page = <EventPage role="admin" kasseMode eventId={parts[1]} />
  else if (parts[0] === 'event' && parts[2] === 'dashboard') page = <Dashboard eventId={parts[1]} />
  else if (parts[0] === 'event') page = <EventPage role="admin" eventId={parts[1]} />
  else if (parts[0] === 'guests') ((page = <GuestsPage />), (tab = 'guests'))
  else if (parts[0] === 'guest') ((page = <GuestPage guestId={parts[1]} />), (tab = 'guests'))
  else if (parts[0] === 'settings') ((page = <SettingsPage />), (tab = 'settings'))
  else page = <EventsPage />

  return (
    <>
      <main className="page">{page}</main>
      <nav className="tabbar">
        <button className={tab === 'events' ? 'on' : ''} onClick={() => navigate('/')}>
          <span>🎟</span>Events
        </button>
        <button className={tab === 'guests' ? 'on' : ''} onClick={() => navigate('/guests')}>
          <span>👥</span>Gäste
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => navigate('/settings')}>
          <span>⚙︎</span>Einstellungen
        </button>
      </nav>
    </>
  )
}

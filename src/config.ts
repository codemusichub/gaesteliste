// Firebase-Web-Konfiguration aus der Firebase-Konsole (Projekteinstellungen > Meine Apps).
// Diese Werte sind nicht geheim; geschützt werden die Daten durch firestore.rules.
export const firebaseConfig = {
  apiKey: 'DEMO_API_KEY',
  authDomain: 'demo-gaesteliste.firebaseapp.com',
  projectId: 'demo-gaesteliste',
  storageBucket: 'demo-gaesteliste.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
}

// Wer Admin ist. Muss mit der Liste in firestore.rules übereinstimmen.
export const ADMIN_EMAILS = ['admin@gaesteliste.app']

// Login der Kasse; das Passwort ist die Kassen-PIN.
export const KASSE_EMAIL = 'kasse@gaesteliste.app'

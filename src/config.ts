// Firebase-Web-Konfiguration aus der Firebase-Konsole (Projekteinstellungen > Meine Apps).
// Diese Werte sind nicht geheim; geschützt werden die Daten durch firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyBAs_A7C9TI8wLIjY2SRpom0vD7_ER7WpI',
  authDomain: 'gaesteliste-e6b34.firebaseapp.com',
  projectId: 'gaesteliste-e6b34',
  storageBucket: 'gaesteliste-e6b34.firebasestorage.app',
  messagingSenderId: '775414693399',
  appId: '1:775414693399:web:fc4160e7fdce325ff9e652',
}

// Wer Admin ist. Muss mit der Liste in firestore.rules übereinstimmen.
export const ADMIN_EMAILS = ['events@code-music.com']

// Login der Kasse; das Passwort ist die Kassen-PIN.
export const KASSE_EMAIL = 'kasse@gaesteliste.app'

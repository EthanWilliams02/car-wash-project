import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const env: Record<string, string | undefined> =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) ||
  (typeof globalThis !== 'undefined' && (globalThis as any).process ? (globalThis as any).process.env : {}) ||
  {};

const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'washwizzy-dev-49122',
  appId: env.VITE_FIREBASE_APP_ID || '1:186558950093:web:c3a1341a464a802f4a1784',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'washwizzy-dev-49122.firebasestorage.app',
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBvH-lIqxoc64EE44044l7XZQ9aSYOa0t0',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'washwizzy-dev-49122.firebaseapp.com',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '186558950093',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to emulator if configured via environment variable
const isEmulator =
  env.VITE_USE_FIREBASE_EMULATOR === 'true' ||
  Boolean(env.FIREBASE_AUTH_EMULATOR_HOST) ||
  Boolean(env.FIRESTORE_EMULATOR_HOST);

if (isEmulator) {
  try {
    const rawAuthHost = env.FIREBASE_AUTH_EMULATOR_HOST || env.VITE_FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    const authUrl = rawAuthHost.startsWith('http') ? rawAuthHost : `http://${rawAuthHost}`;
    connectAuthEmulator(auth, authUrl, { disableWarnings: true });

    const rawFsHost = env.FIRESTORE_EMULATOR_HOST || env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const [fsHost, fsPort] = rawFsHost.split(':');
    connectFirestoreEmulator(db, fsHost, parseInt(fsPort || '8080', 10));
  } catch (e) {
    console.warn('[Firebase] Emulator connection skipped or already initialized:', e);
  }
}

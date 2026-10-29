import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

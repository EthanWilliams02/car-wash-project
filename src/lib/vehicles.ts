import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';

export interface CustomerVehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  preferredPackage?: string;
  createdAt?: number;
}

export function getVehiclesStorageKey(uid?: string | null): string {
  return uid ? `ww_vehicles_${uid}` : 'ww_vehicles_guest';
}

export function getStoredVehicles(uid?: string | null): CustomerVehicle[] {
  try {
    const key = getVehiclesStorageKey(uid);
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load vehicles from localStorage:', e);
  }
  return [];
}

export async function saveCustomerVehicle(
  vehicle: CustomerVehicle,
  uid?: string | null
): Promise<boolean> {
  try {
    const current = getStoredVehicles(uid);
    const existingIdx = current.findIndex((v) => v.id === vehicle.id);
    let updated: CustomerVehicle[];
    if (existingIdx !== -1) {
      updated = current.map((v) => (v.id === vehicle.id ? { ...v, ...vehicle } : v));
    } else {
      updated = [{ ...vehicle, createdAt: vehicle.createdAt || Date.now() }, ...current];
    }
    const key = getVehiclesStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(updated));

    window.dispatchEvent(new CustomEvent('ww_vehicles_changed', { detail: { uid } }));

    if (uid) {
      const docRef = doc(db, 'users', uid, 'vehicles', vehicle.id);
      setDoc(docRef, vehicle, { merge: true }).catch((err) => {
        console.warn('Firestore vehicle sync error:', err);
      });
    }
    return true;
  } catch (e) {
    console.error('Failed to save vehicle:', e);
    return false;
  }
}

export async function deleteCustomerVehicle(id: string, uid?: string | null): Promise<boolean> {
  try {
    const current = getStoredVehicles(uid);
    const updated = current.filter((v) => v.id !== id);
    const key = getVehiclesStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(updated));

    window.dispatchEvent(new CustomEvent('ww_vehicles_changed', { detail: { uid } }));

    if (uid) {
      const docRef = doc(db, 'users', uid, 'vehicles', id);
      deleteDoc(docRef).catch((err) => {
        console.warn('Firestore vehicle delete error:', err);
      });
    }
    return true;
  } catch (e) {
    console.error('Failed to delete vehicle:', e);
    return false;
  }
}

export function subscribeToCustomerVehicles(
  uid: string | null | undefined,
  callback: (vehicles: CustomerVehicle[]) => void
): () => void {
  callback(getStoredVehicles(uid));

  const handleCustomEvent = (e: Event) => {
    const customEvt = e as CustomEvent;
    if (!customEvt.detail || customEvt.detail.uid === uid) {
      callback(getStoredVehicles(uid));
    }
  };

  window.addEventListener('ww_vehicles_changed', handleCustomEvent);
  window.addEventListener('storage', handleCustomEvent);

  if (!uid) {
    return () => {
      window.removeEventListener('ww_vehicles_changed', handleCustomEvent);
      window.removeEventListener('storage', handleCustomEvent);
    };
  }

  try {
    const colRef = collection(db, 'users', uid, 'vehicles');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CustomerVehicle[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          const key = getVehiclesStorageKey(uid);
          localStorage.setItem(key, JSON.stringify(list));
          callback(list);
        }
      },
      (err) => console.warn('Firestore vehicles listener fallback:', err)
    );

    return () => {
      unsub();
      window.removeEventListener('ww_vehicles_changed', handleCustomEvent);
      window.removeEventListener('storage', handleCustomEvent);
    };
  } catch {
    return () => {
      window.removeEventListener('ww_vehicles_changed', handleCustomEvent);
      window.removeEventListener('storage', handleCustomEvent);
    };
  }
}

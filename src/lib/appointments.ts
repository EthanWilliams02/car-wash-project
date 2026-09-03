import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

export interface StoredAppointment {
  id: string;
  packageName: string;
  price: string;
  date: string;
  time: string;
  location?: string;
  address?: string;
  serviceType?: 'Call-out' | 'Drive-in' | string;
  vehicle: string;
  notes?: string;
  status: string;
  statusColor: string;
  staffName: string;
  assignedStaffUid?: string;
  staffStatus: string;
  isLocked: boolean;
  cancellationPolicy?: string;
  cancelReason?: string;
  createdAt: number;
  completed?: boolean;
  confirmed?: boolean;
}

export const CALL_OUT_FEE = 150;

export function calculateCallOutFee(serviceType?: string, hasMembership: boolean = false): number {
  if (serviceType === 'Call-out' && !hasMembership) {
    return CALL_OUT_FEE;
  }
  return 0;
}

export function getAppointmentsStorageKey(uid?: string | null): string {
  return uid ? `ww_appointments_${uid}` : 'ww_appointments_default';
}

export function getStoredAppointments(uid?: string | null): StoredAppointment[] {
  try {
    const key = getAppointmentsStorageKey(uid);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load appointments from localStorage', e);
    return [];
  }
}

export function saveAppointment(appointment: StoredAppointment, uid?: string | null): void {
  try {
    const current = getStoredAppointments(uid);
    const updated = [appointment, ...current.filter((a) => a.id !== appointment.id)];
    const key = getAppointmentsStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(updated));

    if (uid) {
      const apptRef = doc(db, 'users', uid, 'appointments', appointment.id);
      setDoc(apptRef, {
        ...appointment,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch((err) => {
        console.error('Failed to sync appointment to Firestore:', err);
      });
    }
  } catch (e) {
    console.error('Failed to save appointment to localStorage', e);
  }
}

export interface DynamicStatusResult {
  status: string;
  statusColor: string;
  isLocked: boolean;
  isMissed: boolean;
  canReschedule: boolean;
  cancellationPolicy: string;
}

export function isRescheduleEligible(
  dateStr?: string,
  timeStr?: string,
  hasMembership: boolean = false,
  isMissed: boolean = false,
  completed: boolean = false
): boolean {
  if (isMissed || completed) {
    return false;
  }

  const target = parseAppointmentDateTime(dateStr, timeStr);
  if (!target) return false;

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // If appointment time has already passed
  if (diffHours <= 0) {
    return false;
  }

  // If user has a membership: allowed up until 1 hour before appointment time
  if (hasMembership) {
    return diffHours >= 1;
  }

  // If user does not have a membership: only allowed if more than 24 hours away
  return diffHours > 24;
}

export function parseAppointmentDateTime(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr) return null;

  const now = new Date();
  let target = new Date();

  let hours = 12;
  let minutes = 0;

  if (timeStr) {
    const startTimePart = timeStr.split('-')[0].trim();
    const match12 = startTimePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const meridiem = match12[3]?.toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      hours = h;
      minutes = m;
    }
  }

  const lowerDate = dateStr.toLowerCase().trim();

  if (lowerDate.startsWith('today')) {
    target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  } else if (lowerDate.startsWith('tomorrow')) {
    target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    target = new Date(y, m - 1, d, hours, minutes, 0);
  } else {
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
      target = new Date(parsed);
      target.setHours(hours, minutes, 0, 0);
    } else {
      const matchMonthDay = dateStr.match(/([a-zA-Z]+)\s+(\d{1,2})/);
      if (matchMonthDay) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const mIdx = monthNames.findIndex((m) => matchMonthDay[1].toLowerCase().startsWith(m));
        if (mIdx !== -1) {
          const day = parseInt(matchMonthDay[2], 10);
          target = new Date(now.getFullYear(), mIdx, day, hours, minutes, 0);
        }
      }
    }
  }

  return target;
}

export function getDynamicAppointmentStatus(
  dateStr?: string,
  timeStr?: string,
  initialIsMissed?: boolean,
  completed?: boolean,
  hasMembership: boolean = false,
  initialStatus?: string,
  confirmed?: boolean
): DynamicStatusResult {
  if (initialStatus === 'Cancelled') {
    return {
      status: 'Cancelled',
      statusColor: 'red',
      isLocked: true,
      isMissed: false,
      canReschedule: false,
      cancellationPolicy: 'This appointment was cancelled.',
    };
  }

  const canReschedule = isRescheduleEligible(dateStr, timeStr, hasMembership, initialIsMissed, completed);

  if (confirmed === false) {
    return {
      status: 'Awaiting Confirmation',
      statusColor: 'amber',
      isLocked: false,
      isMissed: false,
      canReschedule,
      cancellationPolicy: 'This booking is awaiting confirmation from our team.',
    };
  }

  if (completed) {
    return {
      status: 'Completed',
      statusColor: 'reward-green',
      isLocked: true,
      isMissed: false,
      canReschedule: false,
      cancellationPolicy: 'This appointment has been completed.',
    };
  }

  if (initialIsMissed) {
    return {
      status: 'Missed',
      statusColor: 'red',
      isLocked: true,
      isMissed: true,
      canReschedule: false,
      cancellationPolicy: 'You missed this appointment. Refund requests are subject to approval.',
    };
  }

  const target = parseAppointmentDateTime(dateStr, timeStr);
  const now = new Date();

  if (!target) {
    return {
      status: 'Refund Eligible',
      statusColor: 'reward-green',
      isLocked: false,
      isMissed: false,
      canReschedule,
      cancellationPolicy: 'Cancel before appointment for a full refund.',
    };
  }

  const isSameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();

  const isPastDay =
    new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() <
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (isPastDay) {
    return {
      status: 'Missed',
      statusColor: 'red',
      isLocked: true,
      isMissed: true,
      canReschedule: false,
      cancellationPolicy: 'You missed this appointment. Refund requests are subject to approval.',
    };
  }

  // Same calendar day: Staff on route
  if (isSameDay) {
    return {
      status: 'Staff on route',
      statusColor: 'blue',
      isLocked: true,
      isMissed: false,
      canReschedule,
      cancellationPolicy: 'Appointment is today. Staff is on route and bookings are locked.',
    };
  }

  const diffMs = target.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // Within 24 hours but not the same day: Scheduled with warning
  if (diffHours <= 24 && diffHours > 0) {
    const cutoff = new Date(target.getTime() - 24 * 60 * 60 * 1000);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const cutoffMonth = monthNames[cutoff.getMonth()];
    const cutoffDay = cutoff.getDate();
    let cutoffHours = cutoff.getHours();
    const cutoffMins = cutoff.getMinutes().toString().padStart(2, '0');
    const cutoffMeridiem = cutoffHours >= 12 ? 'PM' : 'AM';
    cutoffHours = cutoffHours % 12 || 12;
    const cutoffStr = `${cutoffMonth} ${cutoffDay}, ${cutoffHours}:${cutoffMins} ${cutoffMeridiem}`;

    return {
      status: 'Scheduled',
      statusColor: 'burnt-orange',
      isLocked: false,
      isMissed: false,
      canReschedule,
      cancellationPolicy: `Cancel before ${cutoffStr} for a full refund. 20% fee applies thereafter.`,
    };
  }

  // More than 24 hours away: Refund Eligible (full refund available)
  const cutoff = new Date(target.getTime() - 24 * 60 * 60 * 1000);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const cutoffMonth = monthNames[cutoff.getMonth()];
  const cutoffDay = cutoff.getDate();
  let cutoffHours = cutoff.getHours();
  const cutoffMins = cutoff.getMinutes().toString().padStart(2, '0');
  const cutoffMeridiem = cutoffHours >= 12 ? 'PM' : 'AM';
  cutoffHours = cutoffHours % 12 || 12;
  const cutoffStr = `${cutoffMonth} ${cutoffDay}, ${cutoffHours}:${cutoffMins} ${cutoffMeridiem}`;

  return {
    status: 'Refund Eligible',
    statusColor: 'reward-green',
    isLocked: false,
    isMissed: false,
    canReschedule,
    cancellationPolicy: `Cancel before ${cutoffStr} for a full refund.`,
  };
}

export function updateAppointment(id: string, updates: Partial<StoredAppointment>, uid?: string | null): void {
  try {
    const current = getStoredAppointments(uid);
    const exists = current.some((appt) => appt.id === id);
    let updated: StoredAppointment[];
    if (exists) {
      updated = current.map((appt) =>
        appt.id === id ? { ...appt, ...updates } : appt
      );
    } else {
      updated = [{ id, ...updates } as StoredAppointment, ...current];
    }
    const key = getAppointmentsStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(updated));

    if (uid) {
      const apptRef = doc(db, 'users', uid, 'appointments', id);
      setDoc(apptRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch((err) => {
        console.error('Failed to sync appointment update to Firestore:', err);
      });
    }
  } catch (e) {
    console.error('Failed to update appointment in localStorage', e);
  }
}

export async function cancelAppointment(id: string, reason: string, uid?: string | null): Promise<void> {
  try {
    const current = getStoredAppointments(uid);
    const updated = current.map((appt) => {
      if (appt.id === id) {
        return {
          ...appt,
          status: 'Cancelled',
          statusColor: 'red',
          isLocked: true,
          cancelReason: reason,
          cancellationPolicy: `Appointment cancelled: "${reason}".`,
        };
      }
      return appt;
    });
    const key = getAppointmentsStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(updated));

    if (uid) {
      const apptRef = doc(db, 'users', uid, 'appointments', id);
      await setDoc(apptRef, {
        status: 'Cancelled',
        statusColor: 'red',
        isLocked: true,
        cancelReason: reason,
        cancellationPolicy: `Appointment cancelled: "${reason}".`,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  } catch (e) {
    console.error('Failed to cancel appointment', e);
  }
}

export async function markAppointmentCompleted(customerUid: string, appointmentId: string): Promise<void> {
  try {
    const apptRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
    await setDoc(apptRef, {
      completed: true,
      status: 'Completed',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Update localStorage cache if it exists for this user
    const current = getStoredAppointments(customerUid);
    if (current.length > 0) {
      const updated = current.map((appt) =>
        appt.id === appointmentId ? { ...appt, completed: true, status: 'Completed' } : appt
      );
      localStorage.setItem(getAppointmentsStorageKey(customerUid), JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to mark appointment completed in Firestore:', e);
    throw e;
  }
}

export async function assignStaffToAppointment(
  customerUid: string,
  appointmentId: string,
  staffUid: string,
  staffName: string
): Promise<void> {
  try {
    const apptRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
    await setDoc(apptRef, {
      assignedStaffUid: staffUid,
      staffName: staffName,
      staffStatus: 'Assigned',
      status: 'Confirmed',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Update localStorage cache if it exists for this user
    const current = getStoredAppointments(customerUid);
    if (current.length > 0) {
      const updated = current.map((appt) =>
        appt.id === appointmentId
          ? {
              ...appt,
              assignedStaffUid: staffUid,
              staffName: staffName,
              staffStatus: 'Assigned',
              status: 'Confirmed',
            }
          : appt
      );
      localStorage.setItem(getAppointmentsStorageKey(customerUid), JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to assign staff to appointment in Firestore:', e);
    throw e;
  }
}

export async function getAllStaffMembers(): Promise<{ uid: string; name: string }[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'staff'));
    const snapshot = await getDocs(q);
    const staffList: { uid: string; name: string }[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const name = data.displayName || data.name || data.fullName || data.email || 'Staff Member';
      staffList.push({
        uid: docSnap.id,
        name,
      });
    });
    return staffList;
  } catch (e) {
    console.error('Failed to fetch staff members:', e);
    return [];
  }
}

export async function getTodaysAppointmentsAcrossAllCustomers(): Promise<(StoredAppointment & { customerUid: string })[]> {
  try {
    const q = query(collectionGroup(db, 'appointments'));
    const snapshot = await getDocs(q);
    const results: (StoredAppointment & { customerUid: string })[] = [];
    const now = new Date();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as StoredAppointment;
      const customerUid = docSnap.ref.parent.parent?.id || '';

      const dateStr = data.date;
      const timeStr = data.time;
      let isToday = false;

      if (dateStr) {
        const lower = dateStr.toLowerCase().trim();
        if (lower.startsWith('today')) {
          isToday = true;
        } else {
          const parsed = parseAppointmentDateTime(dateStr, timeStr);
          if (parsed) {
            isToday =
              parsed.getFullYear() === now.getFullYear() &&
              parsed.getMonth() === now.getMonth() &&
              parsed.getDate() === now.getDate();
          }
        }
      }

      if (isToday) {
        results.push({
          ...data,
          id: docSnap.id,
          customerUid,
        });
      }
    });

    return results;
  } catch (e) {
    console.error('Failed to get today\'s appointments across all customers:', e);
    return [];
  }
}




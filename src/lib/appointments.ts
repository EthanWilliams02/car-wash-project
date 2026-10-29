import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  onSnapshot,
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
  cancelledAt?: number;
  cancelledBy?: string;
  cancelledByName?: string;
  cancelledByRole?: string;
  createdAt: number;
  completed?: boolean;
  confirmed?: boolean;
  confirmedAt?: number;
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedByRole?: string;
  rescheduledByOwner?: boolean;
  rescheduledAt?: number;
  rescheduledBy?: string;
  rescheduledByName?: string;
  rescheduledByRole?: string;
  rescheduleReason?: string;
  previousSchedule?: {
    date: string;
    time: string;
  };
  customerUid?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  phone?: string;
  email?: string;
  updatedAt?: any;
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

export async function saveAppointment(appointment: StoredAppointment, uid?: string | null): Promise<void> {
  // If user is authenticated, Firestore is the authoritative source.
  if (uid) {
    const apptRef = doc(db, 'users', uid, 'appointments', appointment.id);
    await setDoc(
      apptRef,
      {
        ...appointment,
        customerUid: uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // Update local cache safely
  try {
    const current = getStoredAppointments(uid);
    const updated = [appointment, ...current.filter((a) => a.id !== appointment.id)];
    const key = getAppointmentsStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to update appointments cache in localStorage', e);
  }
}

export interface DynamicStatusResult {
  status: string;
  statusColor: string;
  isLocked: boolean;
  isMissed: boolean;
  canReschedule: boolean;
  cancellationPolicy: string;
  isRefundEligible: boolean;
  refundStatusText?: string;
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

/**
 * Calculates the dynamic status and refund eligibility for an appointment.
 * NOTE: Explicit statuses (Cancelled, Awaiting Confirmation, Confirmed, Completed)
 * are NEVER overwritten by date-based calculations like "Refund Eligible" or "Staff on route".
 * Refund eligibility is returned as a separate property.
 */
export function getDynamicAppointmentStatus(
  dateStr?: string,
  timeStr?: string,
  initialIsMissed?: boolean,
  completed?: boolean,
  hasMembership: boolean = false,
  initialStatus?: string,
  confirmed?: boolean,
  staffStatus?: string
): DynamicStatusResult {
  // 1. Explicit cancellation check
  if (initialStatus === 'Cancelled') {
    return {
      status: 'Cancelled',
      statusColor: 'red',
      isLocked: true,
      isMissed: false,
      canReschedule: false,
      isRefundEligible: false,
      cancellationPolicy: 'This appointment was cancelled.',
      refundStatusText: 'Non-refundable (cancelled)',
    };
  }

  // 2. Explicit completion check
  if (completed === true || initialStatus === 'Completed') {
    return {
      status: 'Completed',
      statusColor: 'reward-green',
      isLocked: true,
      isMissed: false,
      canReschedule: false,
      isRefundEligible: false,
      cancellationPolicy: 'This appointment has been completed.',
      refundStatusText: 'Completed',
    };
  }

  const target = parseAppointmentDateTime(dateStr, timeStr);
  const now = new Date();

  // 3. Past check (Missed)
  let isPast = Boolean(initialIsMissed);
  if (!isPast && target) {
    isPast = target.getTime() < now.getTime();
  }

  if (isPast) {
    return {
      status: 'Missed',
      statusColor: 'red',
      isLocked: true,
      isMissed: true,
      canReschedule: false,
      isRefundEligible: false,
      cancellationPolicy: 'You missed this appointment. Refund requests are subject to approval.',
      refundStatusText: 'Subject to approval',
    };
  }

  const canReschedule = isRescheduleEligible(dateStr, timeStr, hasMembership, initialIsMissed, completed);

  // 4. Calculate refund eligibility separately from appointment status
  let isRefundEligible = false;
  let cancellationPolicy = 'Cancellation policies apply.';
  let refundStatusText = '20% fee applies within 24 hours';

  if (target) {
    const diffMs = target.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const cutoff = new Date(target.getTime() - 24 * 60 * 60 * 1000);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const cutoffMonth = monthNames[cutoff.getMonth()];
    const cutoffDay = cutoff.getDate();
    let cutoffHours = cutoff.getHours();
    const cutoffMins = cutoff.getMinutes().toString().padStart(2, '0');
    const cutoffMeridiem = cutoffHours >= 12 ? 'PM' : 'AM';
    cutoffHours = cutoffHours % 12 || 12;
    const cutoffStr = `${cutoffMonth} ${cutoffDay}, ${cutoffHours}:${cutoffMins} ${cutoffMeridiem}`;

    if (diffHours > 24) {
      isRefundEligible = true;
      cancellationPolicy = `Cancel before ${cutoffStr} for a full refund.`;
      refundStatusText = 'Full refund eligible';
    } else if (diffHours > 0) {
      isRefundEligible = true;
      cancellationPolicy = `Cancel before ${cutoffStr} for a full refund. 20% fee applies thereafter.`;
      refundStatusText = 'Partial refund (20% fee)';
    } else {
      isRefundEligible = false;
      cancellationPolicy = 'Appointment time has passed.';
      refundStatusText = 'Non-refundable';
    }
  }

  // 5. Confirmed booking check (Explicit Confirmed takes priority over date-based or refund labels)
  if (confirmed === true || (initialStatus === 'Confirmed' && confirmed !== false)) {
    // Check if staff has explicitly updated their route status
    if (
      staffStatus === 'On Route' ||
      initialStatus === 'Staff on route' ||
      (staffStatus && staffStatus.toLowerCase().includes('on route'))
    ) {
      return {
        status: 'Staff on route',
        statusColor: 'blue',
        isLocked: true,
        isMissed: false,
        canReschedule: false,
        isRefundEligible: false,
        cancellationPolicy: 'Staff is currently on route. Bookings are locked.',
        refundStatusText: 'Non-refundable while on route',
      };
    }

    return {
      status: 'Confirmed',
      statusColor: 'reward-green',
      isLocked: !canReschedule,
      isMissed: false,
      canReschedule,
      isRefundEligible,
      cancellationPolicy,
      refundStatusText,
    };
  }

  // 6. Explicit "Awaiting Confirmation"
  if (confirmed === false || initialStatus === 'Awaiting Confirmation') {
    return {
      status: 'Awaiting Confirmation',
      statusColor: 'amber',
      isLocked: false,
      isMissed: false,
      canReschedule,
      isRefundEligible,
      cancellationPolicy: 'This booking is awaiting confirmation from our team.',
      refundStatusText,
    };
  }

  // 7. Explicit "Staff on route"
  if (
    staffStatus === 'On Route' ||
    initialStatus === 'Staff on route' ||
    (staffStatus && staffStatus.toLowerCase().includes('on route'))
  ) {
    return {
      status: 'Staff on route',
      statusColor: 'blue',
      isLocked: true,
      isMissed: false,
      canReschedule: false,
      isRefundEligible: false,
      cancellationPolicy: 'Staff is currently on route. Bookings are locked.',
      refundStatusText: 'Non-refundable while on route',
    };
  }

  // 8. Default fallback: Confirmed
  return {
    status: 'Confirmed',
    statusColor: 'reward-green',
    isLocked: !canReschedule,
    isMissed: false,
    canReschedule,
    isRefundEligible,
    cancellationPolicy,
    refundStatusText,
  };
}

export async function updateAppointment(
  id: string,
  updates: Partial<StoredAppointment>,
  uid?: string | null
): Promise<void> {
  if (uid) {
    const apptRef = doc(db, 'users', uid, 'appointments', id);
    const existingSnap = await getDoc(apptRef);
    if (existingSnap.exists()) {
      const currentData = existingSnap.data() as StoredAppointment;
      if (currentData.status === 'Cancelled' && updates.status !== 'Cancelled') {
        throw new Error('Cannot update an appointment that has already been cancelled.');
      }
      if (currentData.completed && updates.completed === false) {
        throw new Error('Cannot modify an appointment that has already been completed.');
      }
    }

    await setDoc(
      apptRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // Update local cache
  try {
    const current = getStoredAppointments(uid);
    const exists = current.some((appt) => appt.id === id);
    let updated: StoredAppointment[];
    if (exists) {
      updated = current.map((appt) => (appt.id === id ? { ...appt, ...updates } : appt));
    } else {
      updated = [{ id, ...updates } as StoredAppointment, ...current];
    }
    const key = getAppointmentsStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to update appointment cache in localStorage', e);
  }
}

export async function cancelAppointment(
  id: string,
  reason: string,
  uid?: string | null,
  actingUser?: { uid: string; name?: string; role?: string }
): Promise<void> {
  if (uid) {
    const apptRef = doc(db, 'users', uid, 'appointments', id);
    const snap = await getDoc(apptRef);
    if (snap.exists()) {
      const data = snap.data() as StoredAppointment;
      if (data.status === 'Cancelled') {
        throw new Error('This appointment has already been cancelled.');
      }
      if (data.completed) {
        throw new Error('Cannot cancel an appointment that has already been completed.');
      }
    }

    await setDoc(
      apptRef,
      {
        status: 'Cancelled',
        statusColor: 'red',
        isLocked: true,
        cancelReason: reason,
        cancellationPolicy: `Appointment cancelled: "${reason}".`,
        cancelledAt: Date.now(),
        cancelledBy: actingUser?.uid || uid,
        cancelledByName: actingUser?.name || 'Customer',
        cancelledByRole: actingUser?.role || 'customer',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // Update local cache
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
          cancelledAt: Date.now(),
        };
      }
      return appt;
    });
    const key = getAppointmentsStorageKey(uid);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to cancel appointment in localStorage', e);
  }
}

export async function markAppointmentCompleted(customerUid: string, appointmentId: string): Promise<void> {
  const apptRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
  await setDoc(
    apptRef,
    {
      completed: true,
      status: 'Completed',
      statusColor: 'reward-green',
      isLocked: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const current = getStoredAppointments(customerUid);
  if (current.length > 0) {
    const updated = current.map((appt) =>
      appt.id === appointmentId
        ? { ...appt, completed: true, status: 'Completed', statusColor: 'reward-green', isLocked: true }
        : appt
    );
    localStorage.setItem(getAppointmentsStorageKey(customerUid), JSON.stringify(updated));
  }
}

export async function assignStaffToAppointment(
  customerUid: string,
  appointmentId: string,
  staffUid: string,
  staffName: string
): Promise<void> {
  const apptRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
  await setDoc(
    apptRef,
    {
      assignedStaffUid: staffUid,
      staffName: staffName,
      staffStatus: 'Assigned',
      status: 'Confirmed',
      statusColor: 'reward-green',
      confirmed: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

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
            statusColor: 'reward-green',
            confirmed: true,
          }
        : appt
    );
    localStorage.setItem(getAppointmentsStorageKey(customerUid), JSON.stringify(updated));
  }
}

export async function getAllStaffMembers(): Promise<{ uid: string; name: string; email?: string }[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'staff'));
    const snapshot = await getDocs(q);
    const staffList: { uid: string; name: string; email?: string }[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const name = data.displayName || data.fullName || data.name || data.email || 'Staff Member';
      staffList.push({
        uid: docSnap.id,
        name,
        email: data.email,
      });
    });
    staffList.sort((a, b) => a.name.localeCompare(b.name));
    return staffList;
  } catch (e) {
    console.error('Failed to fetch staff members:', e);
    return [];
  }
}

/**
 * Subscribes to real-time updates for all registered staff members in Firestore.
 */
export function subscribeToStaffMembers(
  callback: (staff: { uid: string; name: string; email?: string }[]) => void,
  onError?: (err: any) => void
): () => void {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'staff'));
  return onSnapshot(
    q,
    (snapshot) => {
      const staffList: { uid: string; name: string; email?: string }[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawName = data.displayName || data.fullName || data.name;
        const name = (typeof rawName === 'string' && rawName.trim()) ? rawName.trim() : 'Staff Member';
        staffList.push({
          uid: docSnap.id,
          name,
          email: data.email,
        });
      });
      staffList.sort((a, b) => a.name.localeCompare(b.name));
      callback(staffList);
    },
    (err) => {
      console.warn('Failed to listen to staff members in Firestore:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribes in real time to all appointments assigned to the logged-in staff member.
 * Narrowly scoped to where assignedStaffUid == staffUid.
 * Unassigned staff will receive an empty list and are blocked by Firestore security rules from reading other appointments.
 */
export function subscribeToStaffAppointments(
  staffUid: string,
  callback: (appointments: (StoredAppointment & { customerUid: string })[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!staffUid) {
    callback([]);
    return () => {};
  }

  const apptsQuery = query(
    collectionGroup(db, 'appointments'),
    where('assignedStaffUid', '==', staffUid)
  );

  return onSnapshot(
    apptsQuery,
    (snapshot) => {
      const list: (StoredAppointment & { customerUid: string })[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StoredAppointment;
        const customerUid = data.customerUid || docSnap.ref.parent.parent?.id || '';
        list.push({
          ...data,
          id: docSnap.id,
          customerUid,
        });
      });

      // Sort by createdAt descending (newest first)
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    },
    (err) => {
      console.error('Failed to listen to staff assigned appointments:', err);
      if (onError) onError(err);
    }
  );
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
    console.error("Failed to get today's appointments across all customers:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin-Specific Appointment Actions & Customer Notifications
// ─────────────────────────────────────────────────────────────────────────────

export interface SendCustomerNotificationInput {
  title: string;
  message: string;
  category?: 'appointments' | 'rewards' | 'promotions' | 'system' | 'reviews' | 'membership';
  icon?: 'calendar' | 'clock' | 'star' | 'crown' | 'gift' | 'check';
  iconColor?: string;
  iconBg?: string;
  link?: string;
  eventId?: string;
  metadata?: Record<string, any>;
}

/**
 * Sends a persistent in-app notification directly to the customer's notifications subcollection.
 * Avoids duplicate notifications on retries by using deterministic document IDs based on eventId.
 */
export async function sendCustomerNotification(
  customerUid: string,
  input: SendCustomerNotificationInput
): Promise<void> {
  if (!customerUid) {
    console.warn('Cannot send notification: customerUid is missing');
    return;
  }

  const { title, message, category = 'appointments', icon = 'calendar', link, eventId, metadata } = input;
  const createdAt = Date.now();

  const iconColor = input.iconColor || (icon === 'calendar' || icon === 'clock' ? 'text-[#E86A33]' : 'text-[#35B86B]');
  const iconBg = input.iconBg || (icon === 'calendar' || icon === 'clock' ? 'bg-[#E86A33]/10' : 'bg-[#35B86B]/10');

  // Use eventId as document id when present to make repeated writes strictly idempotent
  const notifId = eventId || `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const notifDocRef = doc(db, 'users', customerUid, 'notifications', notifId);

  const notifData = {
    id: notifId,
    userId: customerUid,
    category,
    icon,
    iconColor,
    iconBg,
    title,
    message,
    time: 'Just now',
    isRead: false,
    createdAt,
    eventId: eventId || notifId,
    link: link || '/dashboard/customer/appointments',
    metadata: metadata || {},
  };

  await setDoc(notifDocRef, notifData, { merge: true });
}

/**
 * Assign a staff member and confirm an appointment (Owner action).
 * Requires that a real staff member is selected.
 * Atomically updates assignedStaffUid, staffName, staffStatus: 'Assigned',
 * confirmed: true, and status: 'Confirmed' in one write to Firestore.
 * Notifies the customer and the assigned staff member.
 */
export async function confirmAppointmentByOwner(
  customerUid: string,
  appointmentId: string,
  staff: { uid: string; name: string },
  adminUser: { uid: string; name?: string }
): Promise<void> {
  if (!adminUser || !adminUser.uid) {
    throw new Error('Admin authentication is required to confirm appointments.');
  }
  if (!staff || !staff.uid || !staff.name?.trim()) {
    throw new Error('A staff member must be selected before confirming the booking.');
  }
  if (!customerUid?.trim() || !appointmentId?.trim()) {
    throw new Error('Missing required customer or appointment identifier.');
  }

  const apptRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
  const snap = await getDoc(apptRef);

  if (!snap.exists()) {
    throw new Error('Appointment not found.');
  }

  const currentData = snap.data() as StoredAppointment;
  if (currentData.status === 'Cancelled') {
    throw new Error('Cannot confirm a cancelled appointment.');
  }
  if (currentData.completed) {
    throw new Error('Cannot confirm an already completed appointment.');
  }

  const confirmedAt = Date.now();
  const confirmedBy = adminUser.uid;
  const confirmedByName = adminUser.name || 'Owner';
  const assignedStaffName = staff.name.trim();

  // Ensure customer profile details are persisted on the appointment document for assigned staff
  const customerName = currentData.customerName || '';
  const customerEmail = currentData.customerEmail || '';
  const customerPhone = currentData.customerPhone || currentData.phone || '';

  const updatePayload: Record<string, any> = {
    assignedStaffUid: staff.uid,
    staffName: assignedStaffName,
    staffStatus: 'Assigned',
    confirmed: true,
    status: 'Confirmed',
    statusColor: 'reward-green',
    confirmedAt,
    confirmedBy,
    confirmedByName,
    confirmedByRole: 'admin',
    updatedAt: serverTimestamp(),
  };

  if (!customerName || !customerEmail || !customerPhone) {
    try {
      const uSnap = await getDoc(doc(db, 'users', customerUid));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        if (!customerName) updatePayload.customerName = uData.fullName || uData.displayName || 'Customer';
        if (!customerEmail) updatePayload.customerEmail = uData.email || '';
        if (!customerPhone) updatePayload.customerPhone = uData.phoneNumber || uData.phone || '';
      }
    } catch {
      // Ignore user doc read fallback
    }
  }

  // Atomic update to existing appointment document
  await setDoc(apptRef, updatePayload, { merge: true });

  // Update local cache safely for immediate client responsiveness
  try {
    const current = getStoredAppointments(customerUid);
    if (current.length > 0) {
      const updated = current.map((appt) =>
        appt.id === appointmentId
          ? {
              ...appt,
              ...updatePayload,
              assignedStaffUid: staff.uid,
              staffName: assignedStaffName,
              staffStatus: 'Assigned',
              confirmed: true,
              status: 'Confirmed',
              statusColor: 'reward-green',
              confirmedAt,
              confirmedBy,
              confirmedByName,
            }
          : appt
      );
      localStorage.setItem(getAppointmentsStorageKey(customerUid), JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Failed to update local cache in confirmAppointmentByOwner:', e);
  }

  // 1. Send persistent notification to the customer
  try {
    await sendCustomerNotification(customerUid, {
      title: 'Appointment Confirmed',
      message: `Your booking for ${currentData.packageName || 'Wash Service'} on ${currentData.date} at ${currentData.time} has been confirmed. Staff member ${assignedStaffName} has been assigned to your service.`,
      category: 'appointments',
      icon: 'calendar',
      link: '/dashboard/customer/appointments',
      eventId: `appt-confirm-${appointmentId}`,
    });
  } catch (err) {
    console.warn('Failed to send customer confirmation notification:', err);
  }

  // 2. Send persistent notification to the assigned staff member
  try {
    await sendCustomerNotification(staff.uid, {
      title: 'New Service Job Assigned',
      message: `You have been assigned to an appointment for ${currentData.customerName || 'a customer'} (${currentData.packageName || 'Wash Service'}) scheduled for ${currentData.date} at ${currentData.time}.`,
      category: 'appointments',
      icon: 'calendar',
      link: '/dashboard/staff/appointments',
      eventId: `staff-job-${appointmentId}`,
    });
  } catch (err) {
    console.warn('Failed to send staff assignment notification:', err);
  }
}

/**
 * Cancel an appointment (Owner action).
 * Marks the appointment as cancelled in Firestore, records cancellation reason, acting admin,
 * and sends an in-app notification to the customer.
 */
export async function adminCancelAppointment(
  customerUid: string,
  appointmentId: string,
  reason: string,
  adminUser: { uid: string; name?: string }
): Promise<void> {
  if (!reason.trim()) {
    throw new Error('A cancellation reason is required.');
  }

  const apptRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
  const snap = await getDoc(apptRef);

  if (!snap.exists()) {
    throw new Error('Appointment not found.');
  }

  const currentData = snap.data() as StoredAppointment;
  if (currentData.status === 'Cancelled') {
    throw new Error('This appointment has already been cancelled.');
  }
  if (currentData.completed) {
    throw new Error('Cannot cancel an appointment that has already been completed.');
  }

  const cancelledAt = Date.now();
  const cancelledBy = adminUser.uid;
  const cancelledByName = adminUser.name || 'Owner';

  await setDoc(
    apptRef,
    {
      status: 'Cancelled',
      statusColor: 'red',
      isLocked: true,
      cancelReason: reason.trim(),
      cancellationPolicy: `Appointment cancelled by owner: "${reason.trim()}".`,
      cancelledAt,
      cancelledBy,
      cancelledByName,
      cancelledByRole: 'admin',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Send in-app notification containing the reason to the customer
  try {
    await sendCustomerNotification(customerUid, {
      title: 'Appointment Cancelled by Owner',
      message: `Your appointment for ${currentData.packageName || 'Wash Service'} on ${currentData.date} was cancelled by the owner. Reason: "${reason.trim()}".`,
      category: 'appointments',
      icon: 'calendar',
      link: '/dashboard/customer/appointments',
      eventId: `appt-cancel-${appointmentId}`,
    });
  } catch (err) {
    console.warn('Failed to send customer cancellation notification:', err);
  }
}

/**
 * Reschedule an appointment (Owner action).
 * Treats an owner-approved reschedule as confirmed, updates schedule,
 * records previous schedule, reason, and acting admin, and notifies the customer.
 */
export async function adminRescheduleAppointment(
  customerUid: string,
  appointmentId: string,
  newDate: string,
  newTime: string,
  reason: string,
  adminUser: { uid: string; name?: string }
): Promise<void> {
  if (!newDate.trim() || !newTime.trim()) {
    throw new Error('Both new date and time are required.');
  }
  if (!reason.trim()) {
    throw new Error('A reason for rescheduling is required.');
  }

  const apptRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
  const snap = await getDoc(apptRef);

  if (!snap.exists()) {
    throw new Error('Appointment not found.');
  }

  const currentData = snap.data() as StoredAppointment;
  if (currentData.status === 'Cancelled') {
    throw new Error('Cannot reschedule an appointment that has been cancelled.');
  }
  if (currentData.completed) {
    throw new Error('Cannot reschedule an appointment that has already been completed.');
  }

  // Reject past dates
  const newTarget = parseAppointmentDateTime(newDate, newTime);
  if (newTarget && newTarget.getTime() < Date.now()) {
    throw new Error('The new date and time cannot be in the past.');
  }

  const oldDate = currentData.date;
  const oldTime = currentData.time;
  const rescheduledAt = Date.now();
  const rescheduledBy = adminUser.uid;
  const rescheduledByName = adminUser.name || 'Owner';

  // Only keep confirmed status if staff is already assigned and was previously confirmed
  const wasConfirmed = currentData.confirmed === true && Boolean(currentData.assignedStaffUid);

  await setDoc(
    apptRef,
    {
      date: newDate,
      time: newTime,
      confirmed: wasConfirmed,
      status: wasConfirmed ? 'Confirmed' : 'Awaiting Confirmation',
      statusColor: wasConfirmed ? 'reward-green' : 'amber',
      previousSchedule: {
        date: oldDate,
        time: oldTime,
      },
      rescheduledByOwner: true,
      rescheduleReason: reason.trim(),
      rescheduledAt,
      rescheduledBy,
      rescheduledByName,
      rescheduledByRole: 'admin',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Notify customer with old and new schedule details
  try {
    await sendCustomerNotification(customerUid, {
      title: 'Appointment Rescheduled by Owner',
      message: `Your appointment for ${currentData.packageName || 'Wash Service'} originally scheduled for ${oldDate} at ${oldTime} has been rescheduled by the owner to ${newDate} at ${newTime}. Reason: "${reason.trim()}".`,
      category: 'appointments',
      icon: 'clock',
      link: '/dashboard/customer/appointments',
      eventId: `appt-resched-${appointmentId}-${newDate}-${newTime.replace(/\s+/g, '')}`,
    });
  } catch (err) {
    console.warn('Failed to send customer reschedule notification:', err);
  }

  // Also notify assigned staff member if one was assigned
  if (currentData.assignedStaffUid) {
    try {
      await sendCustomerNotification(currentData.assignedStaffUid, {
        title: 'Assigned Service Job Rescheduled',
        message: `Your assigned job for ${currentData.customerName || 'a customer'} (${currentData.packageName || 'Wash Service'}) has been rescheduled to ${newDate} at ${newTime}. Reason: "${reason.trim()}".`,
        category: 'appointments',
        icon: 'clock',
        link: '/dashboard/staff/appointments',
        eventId: `staff-resched-${appointmentId}-${newDate}-${newTime.replace(/\s+/g, '')}`,
      });
    } catch (err) {
      console.warn('Failed to send staff reschedule notification:', err);
    }
  }
}

/**
 * Subscribes to real-time updates for all appointments across all customers via collectionGroup.
 * Fetches user profile names/emails where missing so owner views always have full customer information.
 */
export function subscribeToAllAppointments(
  callback: (appointments: (StoredAppointment & { customerUid: string })[]) => void,
  onError?: (err: any) => void
): () => void {
  const q = query(collectionGroup(db, 'appointments'));

  const userCache: Record<string, { fullName?: string; email?: string; phoneNumber?: string }> = {};

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      const list: (StoredAppointment & { customerUid: string })[] = [];
      const missingUids = new Set<string>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StoredAppointment;
        const customerUid = data.customerUid || docSnap.ref.parent.parent?.id || '';

        list.push({
          ...data,
          id: docSnap.id,
          customerUid,
        });

        if (customerUid && !userCache[customerUid] && (!data.customerName || !data.customerEmail)) {
          missingUids.add(customerUid);
        }
      });

      // Lazy load missing customer profiles in background
      if (missingUids.size > 0) {
        await Promise.all(
          Array.from(missingUids).map(async (uId) => {
            try {
              const uSnap = await getDoc(doc(db, 'users', uId));
              if (uSnap.exists()) {
                const uData = uSnap.data();
                userCache[uId] = {
                  fullName: uData.fullName || uData.displayName,
                  email: uData.email,
                  phoneNumber: uData.phoneNumber,
                };
              }
            } catch (e) {
              // Ignore profile read failure fallback
            }
          })
        );
      }

      // Attach cached customer profile fields if appointment doc didn't store them
      const enriched = list.map((item) => {
        const u = userCache[item.customerUid];
        return {
          ...item,
          customerName: item.customerName || u?.fullName || 'Customer',
          customerEmail: item.customerEmail || u?.email,
          customerPhone: item.customerPhone || u?.phoneNumber,
        };
      });

      // Sort by createdAt descending (newest first)
      enriched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(enriched);
    },
    (error) => {
      console.error('Failed to listen to all customer appointments:', error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

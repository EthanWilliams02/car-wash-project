/// <reference types="node" />
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import {
  parseAppointmentDateTime,
  type StoredAppointment,
} from '../src/lib/appointments';

interface TestAppointment {
  id: string;
  customerUid: string;
  customerName: string;
  customerEmail: string;
  packageName: string;
  price: string;
  date: string;
  time: string;
  serviceType: string;
  address: string;
  vehicle: string;
  status: string;
  statusColor: string;
  confirmed: boolean;
  assignedStaffUid: string | null;
  completed: boolean;
  createdAt: number;
  cancelReason?: string;
  cancelledAt?: number;
  cancelledBy?: string;
  cancelledByName?: string;
  cancelledByRole?: string;
  previousSchedule?: {
    date: string;
    time: string;
  };
  rescheduledAt?: number;
  rescheduledBy?: string;
  rescheduledByName?: string;
  rescheduledByRole?: string;
}

console.log('========================================================================');
console.log(' LIVE VERIFICATION: AUTHORISED CUSTOMER APPOINTMENT & CANCELLATION FLOW');
console.log(' Target: washwizzy-dev-49122 (Live Firebase Production Environment)');
console.log('========================================================================\n');

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, extra: string = '') {
  if (cond) {
    console.log(` [PASS] ${label}${extra ? ' — ' + extra : ''}`);
    pass++;
  } else {
    console.error(` [FAIL] ${label}${extra ? ' — ' + extra : ''}`);
    fail++;
  }
}

const isHistoricalAppointment = (appt: { status?: string; completed?: boolean }): boolean => {
  return appt.status === 'Cancelled' || appt.status === 'Completed' || appt.completed === true;
};

const isAppointmentToday = (dateStr?: string, timeStr?: string): boolean => {
  if (!dateStr) return false;
  const lower = dateStr.toLowerCase().trim();
  if (lower.startsWith('today')) return true;

  const parsed = parseAppointmentDateTime(dateStr, timeStr);
  if (!parsed) return false;

  const now = new Date();
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  );
};

const isAppointmentUpcoming = (dateStr?: string, timeStr?: string): boolean => {
  if (!dateStr) return false;
  if (isAppointmentToday(dateStr, timeStr)) return false;
  const parsed = parseAppointmentDateTime(dateStr, timeStr);
  return Boolean(parsed && parsed.getTime() > Date.now());
};

const isAppointmentPast = (dateStr?: string, timeStr?: string, initialIsMissed?: boolean): boolean => {
  if (initialIsMissed) return true;
  if (!dateStr) return false;
  if (isAppointmentToday(dateStr, timeStr)) return false;
  const parsed = parseAppointmentDateTime(dateStr, timeStr);
  return Boolean(parsed && parsed.getTime() < Date.now());
};

async function runLiveTest() {
  const runId = Date.now();
  const customerEmail = `live_cust_${runId}@example.com`;
  const pwd = 'TestPass@2026!';
  const apptId = `WW-LIVE-${runId}`;

  // STEP 1: Create live customer account under strict production rules
  console.log('1. Creating customer account under live production security rules...');
  const custCred = await createUserWithEmailAndPassword(auth, customerEmail, pwd);
  const custUser = custCred.user;
  await setDoc(doc(db, 'users', custUser.uid), {
    uid: custUser.uid,
    email: customerEmail,
    fullName: 'Live Test Customer',
    role: 'customer',
    createdAt: Date.now(),
  });
  check('Live customer account created', Boolean(custUser.uid), `UID: ${custUser.uid}`);

  // STEP 2: Verify rule enforcement - Customer CANNOT self-elevate to admin
  console.log('\n2. Testing live security rules: Customer elevation block...');
  try {
    await setDoc(doc(db, 'users', custUser.uid), { role: 'admin' }, { merge: true });
    check('Customer elevated to admin (SECURITY BREACH)', false);
  } catch (err: unknown) {
    const errorCode =
      err instanceof FirebaseError
        ? err.code
        : typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string'
          ? (err as { code: string }).code
          : String(err);
    check('Customer blocked from elevating to admin', errorCode === 'permission-denied', errorCode);
  }

  // STEP 3: Customer creates booking adhering to live rules (Awaiting Confirmation, unassigned)
  console.log('\n3. Customer creates booking in live Firestore...');
  const apptRef = doc(db, 'users', custUser.uid, 'appointments', apptId);
  const initialData: TestAppointment = {
    id: apptId,
    customerUid: custUser.uid,
    customerName: 'Live Test Customer',
    customerEmail,
    packageName: 'Deluxe Wash & Wax',
    price: 'R380.00',
    date: '2026-12-10',
    time: '11:00 AM',
    serviceType: 'Call-out',
    address: '42 Kloof St, Cape Town',
    vehicle: 'Volkswagen Golf 7 GTI',
    status: 'Awaiting Confirmation',
    statusColor: 'amber',
    confirmed: false,
    assignedStaffUid: null,
    completed: false,
    createdAt: Date.now(),
  };
  await setDoc(apptRef, initialData);
  check('Customer booking created in live Firestore', true, `Appt ID: ${apptId}`);

  // Customer listener simulation (CustomerAppointments.tsx)
  const liveSnapshots: StoredAppointment[] = [];
  const unsub = onSnapshot(apptRef, (snap) => {
    if (snap.exists()) {
      liveSnapshots.push({ id: snap.id, ...snap.data() } as StoredAppointment);
    }
  });

  await new Promise((r) => setTimeout(r, 1200));
  const currentSnap = liveSnapshots[liveSnapshots.length - 1];
  check('Live listener received initial booking', Boolean(currentSnap));
  check('Booking is NOT historical', !isHistoricalAppointment(currentSnap || {}));
  check('Booking is classified as Upcoming (future date)', isAppointmentUpcoming(currentSnap?.date, currentSnap?.time));

  // STEP 4: Customer reschedules in live Firestore
  console.log('\n4. Customer reschedules booking in live Firestore...');
  await setDoc(
    apptRef,
    {
      date: '2026-12-18',
      time: '03:00 PM',
      previousSchedule: {
        date: '2026-12-10',
        time: '11:00 AM',
      },
      rescheduledAt: Date.now(),
      rescheduledBy: custUser.uid,
      rescheduledByName: 'Live Test Customer',
      rescheduledByRole: 'customer',
    },
    { merge: true }
  );

  await new Promise((r) => setTimeout(r, 1200));
  const rescheduledSnap = liveSnapshots[liveSnapshots.length - 1];
  check('Live listener received reschedule update', rescheduledSnap?.date === '2026-12-18');
  check('rescheduledSnap contains previousSchedule', rescheduledSnap?.previousSchedule?.date === '2026-12-10');

  // STEP 5: Customer cancels booking in live Firestore
  console.log('\n5. Customer cancels booking in live Firestore...');
  await setDoc(
    apptRef,
    {
      status: 'Cancelled',
      statusColor: 'red',
      cancelReason: 'Customer travel plan changes',
      cancelledAt: Date.now(),
      cancelledBy: custUser.uid,
      cancelledByName: 'Live Test Customer',
      cancelledByRole: 'customer',
    },
    { merge: true }
  );

  await new Promise((r) => setTimeout(r, 1200));
  unsub();

  const cancelledSnap = liveSnapshots[liveSnapshots.length - 1];
  check('Live listener received Cancelled status', cancelledSnap?.status === 'Cancelled');
  check('Live listener received cancellation reason', cancelledSnap?.cancelReason === 'Customer travel plan changes');

  // Verify consistent historical treatment on the cancelled record
  check(
    'Cancelled booking is treated as HISTORICAL (status === "Cancelled")',
    isHistoricalAppointment(cancelledSnap || {}) === true
  );

  // Active vs History list membership simulation
  const dummyStaffList = [cancelledSnap!];
  const activeUpcoming = dummyStaffList.filter(
    (a) => !isHistoricalAppointment(a) && isAppointmentUpcoming(a.date, a.time)
  );
  const activeToday = dummyStaffList.filter(
    (a) => !isHistoricalAppointment(a) && isAppointmentToday(a.date, a.time)
  );
  const allActive = dummyStaffList.filter(
    (a) => !isHistoricalAppointment(a) && !isAppointmentPast(a.date, a.time, a.status === 'Missed')
  );
  const historyList = dummyStaffList.filter(
    (a) => isHistoricalAppointment(a) || isAppointmentPast(a.date, a.time, a.status === 'Missed')
  );

  check('Cancelled record EXCLUDED from Active Upcoming list', activeUpcoming.length === 0);
  check('Cancelled record EXCLUDED from Active Today list', activeToday.length === 0);
  check('Cancelled record EXCLUDED from All Active list', allActive.length === 0);
  check('Cancelled record INCLUDED in History list', historyList.length === 1);

  // Action button check
  const actionAllowed = !isHistoricalAppointment(cancelledSnap!) && !isAppointmentPast(cancelledSnap!.date, cancelledSnap!.time, cancelledSnap!.status === 'Missed');
  check('Action button ("Mark Completed") EXCLUDED for cancelled record', actionAllowed === false);

  console.log('\n========================================================================');
  console.log(`LIVE FIRESTORE TEST RESULTS: ${pass} PASSED, ${fail} FAILED`);
  console.log('========================================================================');

  process.exit(fail > 0 ? 1 : 0);
}

runLiveTest().catch((err: unknown) => {
  console.error('Live test error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

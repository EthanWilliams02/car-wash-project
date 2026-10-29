/// <reference types="node" />
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  connectFirestoreEmulator,
} from 'firebase/firestore';
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
  staffName?: string;
  staffStatus?: string;
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
  rescheduleReason?: string;
}

console.log('================================================================================');
console.log(' VERIFICATION: MULTI-ROLE OWNER / CUSTOMER / STAFF CANCELLATION & RESCHEDULE');
console.log(' ISOLATED AUTHENTICATED SESSIONS (Separate Contexts: Owner, Customer, Staff)');
console.log('================================================================================\n');

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

// Historical helper matching staff screens exactly
const isHistoricalAppointment = (appt: { status?: string; completed?: boolean }): boolean => {
  if (!appt) return false;
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

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'washwizzy-dev-49122',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:186558950093:web:c3a1341a464a802f4a1784',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'washwizzy-dev-49122.firebasestorage.app',
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBvH-lIqxoc64EE44044l7XZQ9aSYOa0t0',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'washwizzy-dev-49122.firebaseapp.com',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '186558950093',
};

const isEmulator = Boolean(
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.VITE_USE_FIREBASE_EMULATOR === 'true'
);

console.log(`Environment mode: ${isEmulator ? 'ISOLATED FIREBASE EMULATOR' : 'LIVE FIREBASE BACKEND'}`);

// -----------------------------------------------------------------------------
// Initialize 3 COMPLETELY ISOLATED SESSIONS (Isolated App & Auth Contexts)
// -----------------------------------------------------------------------------
const ownerApp = initializeApp(firebaseConfig, 'context-owner-session');
const ownerAuth = getAuth(ownerApp);
const ownerDb = getFirestore(ownerApp);

const customerApp = initializeApp(firebaseConfig, 'context-customer-session');
const customerAuth = getAuth(customerApp);
const customerDb = getFirestore(customerApp);

const staffApp = initializeApp(firebaseConfig, 'context-staff-session');
const staffAuth = getAuth(staffApp);
const staffDb = getFirestore(staffApp);

if (isEmulator) {
  const authUrl = 'http://127.0.0.1:9099';
  connectAuthEmulator(ownerAuth, authUrl, { disableWarnings: true });
  connectAuthEmulator(customerAuth, authUrl, { disableWarnings: true });
  connectAuthEmulator(staffAuth, authUrl, { disableWarnings: true });

  connectFirestoreEmulator(ownerDb, '127.0.0.1', 8080);
  connectFirestoreEmulator(customerDb, '127.0.0.1', 8080);
  connectFirestoreEmulator(staffDb, '127.0.0.1', 8080);
}

async function setEmulatorAdminClaim(uid: string) {
  try {
    const res = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: uid,
        customAttributes: JSON.stringify({ role: 'admin' }),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn('Set claim response not ok:', res.status, txt);
    } else {
      console.log('Set emulator admin custom claim successfully!');
    }
  } catch (err: unknown) {
    console.warn('Could not set emulator admin claim:', err instanceof Error ? err.message : String(err));
  }
}

async function runVerification() {
  const runId = Date.now();
  const ownerEmail = `isolated_owner_${runId}@washwizzy.com`;
  const custEmail = `isolated_cust_${runId}@washwizzy.com`;
  const staffEmail = `isolated_staff_${runId}@washwizzy.com`;
  const pwd = 'TestSessionPass@2026!';
  const apptId = `WW-CTX-${runId}`;

  console.log('\n1. Establishing separate authenticated sessions for each role...');

  // Owner Session in Context 1
  const ownerCred = await createUserWithEmailAndPassword(ownerAuth, ownerEmail, pwd);
  const ownerUser = ownerCred.user;
  
  if (isEmulator) {
    await setEmulatorAdminClaim(ownerUser.uid);
    await ownerUser.getIdToken(true);
  }

  await setDoc(doc(ownerDb, 'users', ownerUser.uid), {
    uid: ownerUser.uid,
    email: ownerEmail,
    displayName: 'WashWizzy Owner',
    role: 'admin',
    createdAt: Date.now(),
  });
  check('Owner authenticated in Context 1', ownerAuth.currentUser?.uid === ownerUser.uid, `UID: ${ownerUser.uid}`);

  // Customer Session in Context 2
  const custCred = await createUserWithEmailAndPassword(customerAuth, custEmail, pwd);
  const custUser = custCred.user;
  await setDoc(doc(customerDb, 'users', custUser.uid), {
    uid: custUser.uid,
    email: custEmail,
    fullName: 'Jane Doe Customer',
    role: 'customer',
    createdAt: Date.now(),
  });
  check('Customer authenticated in Context 2', customerAuth.currentUser?.uid === custUser.uid, `UID: ${custUser.uid}`);

  // Staff Session in Context 3
  const staffCred = await createUserWithEmailAndPassword(staffAuth, staffEmail, pwd);
  const staffUser = staffCred.user;
  await setDoc(doc(staffDb, 'users', staffUser.uid), {
    uid: staffUser.uid,
    email: staffEmail,
    displayName: 'Marcus Staff',
    role: 'staff',
    createdAt: Date.now(),
  });
  check('Staff authenticated in Context 3', staffAuth.currentUser?.uid === staffUser.uid, `UID: ${staffUser.uid}`);

  check('Context 1, Context 2, and Context 3 have mutually distinct auth UIDs',
    ownerAuth.currentUser?.uid !== customerAuth.currentUser?.uid &&
    customerAuth.currentUser?.uid !== staffAuth.currentUser?.uid
  );

  // 2. Customer creates booking in Context 2
  console.log('\n2. Customer creates booking in Context 2...');
  const custApptRef = doc(customerDb, 'users', custUser.uid, 'appointments', apptId);
  const initialApptData: TestAppointment = {
    id: apptId,
    customerUid: custUser.uid,
    customerName: 'Jane Doe Customer',
    customerEmail: custEmail,
    packageName: 'Interior & Exterior Deluxe',
    price: 'R 350',
    date: '2026-11-20',
    time: '09:00 AM',
    serviceType: 'Call-out',
    address: '15 Long Street, Cape Town',
    vehicle: 'BMW 320i',
    status: 'Awaiting Confirmation',
    statusColor: 'amber',
    confirmed: false,
    assignedStaffUid: null,
    completed: false,
    createdAt: Date.now(),
  };
  await setDoc(custApptRef, initialApptData);
  check('Customer booking created in Context 2', true, `Appt ID: ${apptId}`);

  // 3. Owner confirms booking and assigns staff in Context 1
  console.log('\n3. Owner confirms booking and assigns Marcus Staff in Context 1...');
  const ownerApptRef = doc(ownerDb, 'users', custUser.uid, 'appointments', apptId);
  await setDoc(
    ownerApptRef,
    {
      confirmed: true,
      confirmedAt: Date.now(),
      confirmedBy: ownerUser.uid,
      confirmedByName: 'WashWizzy Owner',
      confirmedByRole: 'admin',
      assignedStaffUid: staffUser.uid,
      staffName: 'Marcus Staff',
      staffStatus: 'Assigned',
      status: 'Confirmed',
      statusColor: 'reward-green',
    },
    { merge: true }
  );
  check('Owner confirmed booking and assigned staff in Context 1', true);

  // 4. Staff Screen state & details modal in Context 3
  console.log('\n4. Staff opens Staff Appointments & opens Booking Details modal in Context 3...');
  let staffListState: StoredAppointment[] = [];
  const staffApptRef = doc(staffDb, 'users', custUser.uid, 'appointments', apptId);

  const unsubStaff = onSnapshot(staffApptRef, (snap) => {
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() } as StoredAppointment;
      const idx = staffListState.findIndex((a) => a.id === snap.id);
      if (idx >= 0) {
        staffListState[idx] = data;
      } else {
        staffListState.push(data);
      }
      staffListState = [...staffListState];
    }
  });

  await new Promise((r) => setTimeout(r, 1200));

  const selectedApptId: string | null = apptId;
  const getOpenModalData = () => {
    if (!selectedApptId) return null;
    return staffListState.find((a) => a.id === selectedApptId) || null;
  };

  let modal = getOpenModalData();
  check('Staff Context 3 open modal displays assigned booking', modal?.id === apptId);
  check('Modal reflects initial scheduled date: 2026-11-20', modal?.date === '2026-11-20');
  check('Modal reflects confirmed status: Confirmed', modal?.status === 'Confirmed');

  // 5. Owner performs RESCHEDULE in Context 1
  console.log('\n5. Owner performs RESCHEDULE from Context 1 session...');
  await setDoc(
    ownerApptRef,
    {
      date: '2026-11-28',
      time: '02:30 PM',
      previousSchedule: {
        date: '2026-11-20',
        time: '09:00 AM',
      },
      rescheduledAt: Date.now(),
      rescheduledBy: ownerUser.uid,
      rescheduledByName: 'WashWizzy Owner',
      rescheduledByRole: 'admin',
      rescheduleReason: 'Shop bay maintenance schedule adjustment',
    },
    { merge: true }
  );

  // Wait for real-time propagation to Staff Context 3
  await new Promise((r) => setTimeout(r, 1500));
  modal = getOpenModalData();

  check(
    'Staff Context 3 modal IMMEDIATELY updated date to 2026-11-28 in real time',
    modal?.date === '2026-11-28' && modal?.time === '02:30 PM'
  );
  check(
    'Staff Context 3 modal IMMEDIATELY displays previous schedule: 2026-11-20 at 09:00 AM',
    modal?.previousSchedule?.date === '2026-11-20' && modal?.previousSchedule?.time === '09:00 AM'
  );

  // 6. Customer performs CANCELLATION in Context 2
  console.log('\n6. Customer performs CANCELLATION from Context 2 session...');
  await setDoc(
    custApptRef,
    {
      status: 'Cancelled',
      statusColor: 'red',
      cancelReason: 'Customer schedule conflict',
      cancelledAt: Date.now(),
      cancelledBy: custUser.uid,
      cancelledByName: 'Jane Doe Customer',
      cancelledByRole: 'customer',
    },
    { merge: true }
  );

  // Wait for real-time propagation to Staff Context 3
  await new Promise((r) => setTimeout(r, 1500));
  unsubStaff();
  modal = getOpenModalData();

  check(
    'Staff Context 3 modal IMMEDIATELY updated status to "Cancelled" in real time',
    modal?.status === 'Cancelled'
  );
  check(
    'Staff Context 3 modal IMMEDIATELY displays cancellation reason',
    modal?.cancelReason === 'Customer schedule conflict'
  );

  // 7. Verify Staff screen lists and counters reflect the cancellation immediately
  console.log('\n7. Verifying Staff screen list segmentation, counters, and action button exclusion...');
  
  const activeUpcoming = staffListState.filter(
    (a) => !isHistoricalAppointment(a) && isAppointmentUpcoming(a.date, a.time)
  );
  const activeToday = staffListState.filter(
    (a) => !isHistoricalAppointment(a) && isAppointmentToday(a.date, a.time)
  );
  const allActive = staffListState.filter(
    (a) => !isHistoricalAppointment(a) && !isAppointmentPast(a.date, a.time, a.status === 'Missed')
  );
  const historyList = staffListState.filter(
    (a) => isHistoricalAppointment(a) || isAppointmentPast(a.date, a.time, a.status === 'Missed')
  );

  check('Cancelled appointment EXCLUDED from Upcoming list (Length: 0)', activeUpcoming.length === 0);
  check('Cancelled appointment EXCLUDED from Today list (Length: 0)', activeToday.length === 0);
  check('Cancelled appointment EXCLUDED from All Active list (Length: 0)', allActive.length === 0);
  check('Cancelled appointment INCLUDED in History list (Length: 1)', historyList.length === 1 && historyList[0].id === apptId);

  // Action button check
  const actionAllowed = !isHistoricalAppointment(modal || {}) && !isAppointmentPast(modal?.date, modal?.time, modal?.status === 'Missed');
  check('Action button ("Mark Completed") EXCLUDED for cancelled record in Staff UI', actionAllowed === false);

  console.log('\n================================================================================');
  console.log(`ISOLATED SESSIONS VERIFICATION RESULTS: ${pass} PASSED, ${fail} FAILED`);
  console.log('================================================================================');

  process.exit(fail > 0 ? 1 : 0);
}

runVerification().catch((err: unknown) => {
  console.error('Execution error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

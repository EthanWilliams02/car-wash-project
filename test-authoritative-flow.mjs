import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBvH-lIqxoc64EE44044l7XZQ9aSYOa0t0",
  authDomain: "washwizzy-dev-49122.firebaseapp.com",
  projectId: "washwizzy-dev-49122",
  storageBucket: "washwizzy-dev-49122.firebasestorage.app",
  messagingSenderId: "186558950093",
  appId: "1:186558950093:web:c3a1341a464a802f4a1784",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

import {
  getAllStaffMembers,
  subscribeToStaffMembers,
  getDynamicAppointmentStatus,
  confirmAppointmentByOwner
} from './src/lib/appointments';

let passed = 0;
let failed = 0;

function check(label, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${label}${details ? ' - ' + details : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${label}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

async function run() {
  console.log('=== VERIFYING PRE-REGISTERED STAFF DROPDOWN & CONFIRMATION FLOW ===\n');

  // STEP 1: Verify pre_registered_staff is authoritative
  let staffList = [];
  let unsub = subscribeToStaffMembers((list) => {
    staffList = list;
  });

  await new Promise((r) => setTimeout(r, 1500));
  unsub();

  console.log(`\nReceived ${staffList.length} staff members from subscribeToStaffMembers:`);
  for (const s of staffList) {
    console.log(`- [${s.isActivated ? 'ACTIVATED' : 'PENDING'}] Name: "${s.name}" | EmpID: ${s.employeeId} | Email: ${s.email} | Auth UID: ${s.uid || '(none)'}`);
  }

  check('Dropdown length matches pre_registered_staff count', staffList.length === 7, `Count: ${staffList.length}`);
  check('No test staff or rogue role:staff accounts included', !staffList.some(s => s.name === 'Alex Morgan' || s.name === 'Brian Smith'));
  check('No generic "Staff Member" names', !staffList.some(s => s.name === 'Staff Member'));
  check('No emails displayed as names', !staffList.some(s => s.name.includes('@')));

  const gojoStaff = staffList.find(s => s.employeeId === 'EMP009');
  check('EMP009 (Satoru Gojo) is marked as ACTIVATED', gojoStaff?.isActivated === true);
  check('EMP009 has correct Auth UID', Boolean(gojoStaff?.uid), `UID: ${gojoStaff?.uid}`);
  check('EMP009 has registered full name "Satoru Gojo"', gojoStaff?.name === 'Satoru Gojo');

  const pendingStaff = staffList.filter(s => !s.isActivated);
  check('Other unactivated pre-registered staff remain PENDING', pendingStaff.length > 0, `Pending count: ${pendingStaff.length}`);
  check('Pending staff have empty UIDs for assignment safety', pendingStaff.every(s => !s.uid));

  // STEP 2: Customer creates booking in Awaiting Confirmation
  console.log('\n--- Testing Customer Booking & Real-time Update ---');
  const custEmail = `cust_${Date.now()}@example.com`;
  const custCred = await createUserWithEmailAndPassword(auth, custEmail, 'CustPass123!');
  const custUser = custCred.user;

  // Set customer profile
  await setDoc(doc(db, 'users', custUser.uid), {
    uid: custUser.uid,
    email: custEmail,
    fullName: 'Sarah Connor',
    role: 'customer',
    createdAt: Date.now(),
  });

  const apptId = `WW-LIVE-${Date.now()}`;
  const apptRef = doc(db, 'users', custUser.uid, 'appointments', apptId);

  await setDoc(apptRef, {
    id: apptId,
    customerUid: custUser.uid,
    customerName: 'Sarah Connor',
    date: 'Tomorrow, 11:00 AM',
    time: '11:00 AM',
    packageName: 'Full Valet Wash',
    price: 'R 450',
    status: 'Awaiting Confirmation',
    statusColor: 'amber',
    confirmed: false,
    createdAt: Date.now(),
  });

  // Customer real-time listener (simulating CustomerAppointments.tsx)
  const customerEvents = [];
  const unsubCust = onSnapshot(apptRef, (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      const dyn = getDynamicAppointmentStatus(d.date, d.time, false, d.completed, false, d.status, d.confirmed, d.staffStatus);
      customerEvents.push({ status: dyn.status, color: dyn.statusColor, assignedStaffUid: d.assignedStaffUid, staffName: d.staffName });
    }
  });

  await new Promise((r) => setTimeout(r, 600));
  check('Initial customer badge is Awaiting Confirmation in amber',
    customerEvents[0]?.status === 'Awaiting Confirmation' && customerEvents[0]?.color === 'amber');

  // STEP 3: Switch to Owner/Admin session to confirm & assign staff
  console.log('\n--- Owner assigns registered staff Satoru Gojo & confirms ---');
  const adminEmail = `admin_live_${Date.now()}@example.com`;
  const adminCred = await createUserWithEmailAndPassword(auth, adminEmail, 'AdminPass123!');
  const adminUser = adminCred.user;

  // Give this account admin role in users
  await setDoc(doc(db, 'users', adminUser.uid), {
    uid: adminUser.uid,
    email: adminEmail,
    role: 'admin',
    displayName: 'WashWizzy Admin',
    createdAt: Date.now(),
  });

  // Call confirmAppointmentByOwner as the signed-in admin
  await confirmAppointmentByOwner(
    custUser.uid,
    apptId,
    { uid: gojoStaff.uid, name: gojoStaff.name },
    { uid: adminUser.uid, name: 'WashWizzy Admin' }
  );

  // Wait for real-time customer listener to receive the Firestore document update
  await new Promise((r) => setTimeout(r, 1000));
  unsubCust();

  const latestEvent = customerEvents[customerEvents.length - 1];
  check('Customer status updated in real time to "Confirmed"', latestEvent.status === 'Confirmed');
  check('Customer badge color is green ("reward-green")', latestEvent.color === 'reward-green');
  check('Saved assignedStaffUid matches Satoru Gojo Auth UID', latestEvent.assignedStaffUid === gojoStaff.uid, `UID: ${latestEvent.assignedStaffUid}`);
  check('Saved staffName matches Satoru Gojo', latestEvent.staffName === 'Satoru Gojo');

  console.log(`\n=================================================================`);
  console.log(`TOTAL VERIFIED CHECKS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=================================================================`);
  process.exit(failed > 0 ? 1 : 0);
}

run();

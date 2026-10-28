/**
 * End-to-end flow test for appointment management.
 * Run from project root: node test-flow.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

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

let pass = 0;
let fail = 0;

function check(label, result, extra = '') {
  if (result) {
    console.log(`   PASS: ${label}${extra ? ' — ' + extra : ''}`);
    pass++;
  } else {
    console.error(`   FAIL: ${label}${extra ? ' — ' + extra : ''}`);
    fail++;
  }
}

async function run() {
  console.log('=== WASHWIZZY APPOINTMENT FLOW — END-TO-END TEST ===');
  const testRunId = Date.now();

  const customerEmail = `test_cust_${testRunId}@example.com`;
  const staffEmail    = `test_staff_${testRunId}@example.com`;
  const customerPwd   = 'CustPass123!';
  const staffPwd      = 'StaffPass123!';

  let customerUser = null;
  let staffUser    = null;
  let adminUser    = null;
  const apptId = `WW-TEST-${testRunId}`;

  try {
    // 1. Create customer
    console.log('\n1. Creating customer account...');
    const custCred = await createUserWithEmailAndPassword(auth, customerEmail, customerPwd);
    customerUser = custCred.user;
    await setDoc(doc(db, 'users', customerUser.uid), {
      email: customerEmail, fullName: 'Test Customer', role: 'customer', createdAt: Date.now(),
    });
    check('Customer account created', true, `UID: ${customerUser.uid}`);

    // 2. Create staff
    console.log('\n2. Creating staff account...');
    const staffCred = await createUserWithEmailAndPassword(auth, staffEmail, staffPwd);
    staffUser = staffCred.user;
    await setDoc(doc(db, 'users', staffUser.uid), {
      email: staffEmail, displayName: 'Test Staff Member', role: 'staff', createdAt: Date.now(),
    });
    check('Staff account created', true, `UID: ${staffUser.uid}`);

    // 3. Customer creates booking
    await signOut(auth);
    console.log('\n3. Customer creates booking...');
    await signInWithEmailAndPassword(auth, customerEmail, customerPwd);
    const apptRef = doc(db, 'users', customerUser.uid, 'appointments', apptId);
    await setDoc(apptRef, {
      id: apptId,
      customerUid: customerUser.uid,
      customerName: 'Test Customer',
      customerEmail,
      packageName: 'Premium Wash',
      price: 'R316.25',
      date: 'Fri, Nov 07, 2026',
      time: '10:00 AM',
      serviceType: 'Call-out',
      address: '123 Bree Street, Cape Town',
      vehicle: 'Tesla Model 3',
      confirmed: false,
      status: 'Awaiting Confirmation',
      statusColor: 'amber',
      staffName: 'Pending Assignment',
      staffStatus: 'Finding Staff...',
      isLocked: false,
      createdAt: Date.now(),
    });
    const readSnap = await getDoc(apptRef);
    check('Booking created with Awaiting Confirmation',
      readSnap.exists() && readSnap.data().status === 'Awaiting Confirmation' && readSnap.data().confirmed === false);

    // 4. Customer cannot self-confirm
    console.log('\n4. Customer cannot self-confirm...');
    try {
      await setDoc(apptRef, { confirmed: true, status: 'Confirmed' }, { merge: true });
      check('Customer blocked from self-confirming', false);
    } catch (e) {
      check('Customer blocked from self-confirming', true, e.code);
    }

    // 5. Customer cannot self-assign staff
    console.log('\n5. Customer cannot self-assign staff...');
    try {
      await setDoc(apptRef, { assignedStaffUid: staffUser.uid }, { merge: true });
      check('Customer blocked from self-assigning staff', false);
    } catch (e) {
      check('Customer blocked from self-assigning staff', true, e.code);
    }

    // 6. Customer cannot query collectionGroup
    console.log('\n6. Customer cannot query collectionGroup...');
    try {
      await getDocs(query(collectionGroup(db, 'appointments')));
      check('Customer blocked from collectionGroup', false);
    } catch (e) {
      check('Customer blocked from collectionGroup', true, e.code);
    }

    // 7. Admin sign-in and collectionGroup query
    await signOut(auth);
    console.log('\n7. Admin queries collectionGroup...');
    try {
      const adminCred = await signInWithEmailAndPassword(auth, 'washwizzy02@gmail.com', 'Washwizzy@2024');
      adminUser = adminCred.user;
      check('Admin sign-in succeeded', true, `UID: ${adminUser.uid}`);
    } catch (e) {
      check('Admin sign-in succeeded', false, e.message);
      process.exit(1);
    }

    try {
      const snap = await getDocs(query(collectionGroup(db, 'appointments')));
      check('Admin collectionGroup query succeeded', true, `${snap.size} docs`);
      check("Customer booking in admin query", snap.docs.some((d) => d.id === apptId));
    } catch (e) {
      check('Admin collectionGroup query succeeded', false, `${e.code}: ${e.message}`);
    }

    // 8. Admin queries staff list
    console.log('\n8. Admin queries staff list...');
    try {
      const staffSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'staff')));
      check('Admin can query staff accounts', staffSnap.size > 0, `${staffSnap.size} staff found`);
      check('New staff account visible', staffSnap.docs.some((d) => d.id === staffUser.uid));
    } catch (e) {
      check('Admin can query staff accounts', false, `${e.code}: ${e.message}`);
    }

    // 9. Admin: atomic assign + confirm
    console.log('\n9. Admin assigns staff and confirms (atomic write)...');
    try {
      await setDoc(apptRef, {
        assignedStaffUid: staffUser.uid,
        staffName: 'Test Staff Member',
        staffStatus: 'Assigned',
        confirmed: true,
        status: 'Confirmed',
        statusColor: 'burnt-orange',
        confirmedAt: Date.now(),
        confirmedBy: adminUser.uid,
        confirmedByName: 'WashWizzy Owner',
        confirmedByRole: 'admin',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const d = (await getDoc(apptRef)).data();
      check('Status = Confirmed after atomic write', d.status === 'Confirmed');
      check('confirmed = true', d.confirmed === true);
      check('assignedStaffUid saved', d.assignedStaffUid === staffUser.uid);
      check('staffName saved', d.staffName === 'Test Staff Member');
      check('staffStatus = Assigned', d.staffStatus === 'Assigned');
    } catch (e) {
      check('Atomic assign+confirm write', false, `${e.code}: ${e.message}`);
    }

    // 10. Customer sees Confirmed + staff name
    console.log('\n10. Customer verifies Confirmed status and staff name...');
    await signOut(auth);
    await signInWithEmailAndPassword(auth, customerEmail, customerPwd);
    const cd = (await getDoc(apptRef)).data();
    check('Customer sees status = Confirmed', cd.status === 'Confirmed');
    check('Customer sees staffName', cd.staffName === 'Test Staff Member');
    check('Customer sees confirmed = true', cd.confirmed === true);

    // 11. Staff sees assigned job via collectionGroup
    console.log('\n11. Staff sees assigned job via collectionGroup...');
    await signOut(auth);
    await signInWithEmailAndPassword(auth, staffEmail, staffPwd);
    try {
      const sSnap = await getDocs(
        query(collectionGroup(db, 'appointments'), where('assignedStaffUid', '==', staffUser.uid))
      );
      check('Staff collectionGroup query succeeded', sSnap.size > 0, `${sSnap.size} job(s)`);
      check('Assigned job appears in staff query', sSnap.docs.some((d) => d.id === apptId));
    } catch (e) {
      check('Staff collectionGroup query', false, `${e.code}: ${e.message}`);
    }

    // 12. Staff blocked from reading unassigned appointment
    console.log('\n12. Staff cannot read unassigned appointments...');
    // Create a second booking (signed in as customer)
    await signOut(auth);
    await signInWithEmailAndPassword(auth, customerEmail, customerPwd);
    const appt2Ref = doc(db, 'users', customerUser.uid, 'appointments', `WW-TEST2-${testRunId}`);
    await setDoc(appt2Ref, {
      customerUid: customerUser.uid, status: 'Awaiting Confirmation',
      confirmed: false, date: 'Mon, Nov 10, 2026', createdAt: Date.now(),
    });
    await signOut(auth);
    await signInWithEmailAndPassword(auth, staffEmail, staffPwd);
    try {
      await getDoc(appt2Ref);
      check('Staff blocked from reading unassigned appointment', false);
    } catch (e) {
      check('Staff blocked from reading unassigned appointment', true, e.code);
    }

    // 13. Admin reschedules confirmed+assigned booking (stays Confirmed)
    console.log('\n13. Admin reschedules confirmed booking (stays Confirmed)...');
    await signOut(auth);
    await signInWithEmailAndPassword(auth, 'washwizzy02@gmail.com', 'Washwizzy@2024');
    try {
      await setDoc(apptRef, {
        date: 'Mon, Nov 10, 2026', time: '2:00 PM',
        confirmed: true, status: 'Confirmed',
        previousSchedule: { date: 'Fri, Nov 07, 2026', time: '10:00 AM' },
        rescheduledByOwner: true, rescheduleReason: 'Bay scheduling conflict',
        rescheduledAt: Date.now(), updatedAt: serverTimestamp(),
      }, { merge: true });
      const rd = (await getDoc(apptRef)).data();
      check('Rescheduled confirmed booking stays Confirmed', rd.status === 'Confirmed');
      check('Previous schedule recorded', Boolean(rd.previousSchedule?.date));
      check('Rescheduled by owner flag set', rd.rescheduledByOwner === true);
    } catch (e) {
      check('Admin reschedule (confirmed)', false, `${e.code}: ${e.message}`);
    }

    // 14. Admin cancels appointment
    console.log('\n14. Admin cancels appointment...');
    const cancelReason = 'Rain forecasted — rescheduled at customer request';
    try {
      await setDoc(apptRef, {
        status: 'Cancelled', statusColor: 'red', isLocked: true,
        cancelReason, cancelledAt: Date.now(), cancelledBy: adminUser.uid,
        cancelledByRole: 'admin', updatedAt: serverTimestamp(),
      }, { merge: true });
      const cd2 = (await getDoc(apptRef)).data();
      check('Booking cancelled', cd2.status === 'Cancelled');
      check('Cancel reason recorded', cd2.cancelReason === cancelReason);
    } catch (e) {
      check('Admin cancellation', false, `${e.code}: ${e.message}`);
    }

    // 15. Admin blocked from modifying cancelled booking
    console.log('\n15. Admin cannot modify a cancelled booking...');
    try {
      await setDoc(apptRef, { status: 'Confirmed' }, { merge: true });
      check('Admin blocked from modifying cancelled booking', false);
    } catch (e) {
      check('Admin blocked from modifying cancelled booking', true, e.code);
    }

    // 16. Customer blocked from modifying cancelled booking
    console.log('\n16. Customer cannot modify a cancelled booking...');
    await signOut(auth);
    await signInWithEmailAndPassword(auth, customerEmail, customerPwd);
    try {
      await setDoc(apptRef, { date: 'Tue, Nov 11, 2026' }, { merge: true });
      check('Customer blocked from modifying cancelled booking', false);
    } catch (e) {
      check('Customer blocked from modifying cancelled booking', true, e.code);
    }

    console.log('\n=== ALL CHECKS COMPLETED ===');
  } catch (err) {
    console.error('\nUnexpected test error:', err);
  } finally {
    await signOut(auth).catch(() => {});
    console.log(`\nRESULTS: ${pass} passed, ${fail} failed\n`);
    process.exit(fail > 0 ? 1 : 0);
  }
}

run();

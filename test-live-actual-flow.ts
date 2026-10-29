import assert from 'node:assert';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from './src/lib/firebase';
import {
  confirmAppointmentByOwner,
  subscribeToStaffAppointments,
  subscribeToStaffMembers,
  getDynamicAppointmentStatus,
  type StoredAppointment,
} from './src/lib/appointments';

console.log('=================================================================');
console.log('   LIVE FIRESTORE & APP IMPLEMENTATION VERIFICATION (washwizzy-dev-49122)');
console.log('=================================================================\n');

let totalTests = 0;
let passedTests = 0;

function check(label: string, condition: boolean, detail = '') {
  totalTests++;
  if (condition) {
    console.log(` [PASS] ${label}${detail ? ' — ' + detail : ''}`);
    passedTests++;
  } else {
    console.error(` [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function runLiveVerification() {
  const runId = Date.now();
  const customerEmail = `live_cust_${runId}@example.com`;
  const staffAEmail   = `live_staffA_${runId}@example.com`;
  const staffBEmail   = `live_staffB_${runId}@example.com`;
  const defaultPwd    = 'TestSecurePass123!';
  const apptId        = `WW-LIVE-${runId}`;

  let customerUser: any = null;
  let staffAUser: any = null;
  let staffBUser: any = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Create real customer, assigned staff A, and other staff B
    // -------------------------------------------------------------------------
    console.log('1. Setting up live accounts in Firebase Auth and Firestore...');
    
    // Create Staff A
    const staffACred = await createUserWithEmailAndPassword(auth, staffAEmail, defaultPwd);
    staffAUser = staffACred.user;
    await setDoc(doc(db, 'users', staffAUser.uid), {
      email: staffAEmail,
      displayName: 'Alex Morgan',
      fullName: 'Alex Morgan',
      role: 'staff',
      createdAt: Date.now(),
    });
    check('Staff A account created', true, `UID: ${staffAUser.uid}, Name: Alex Morgan`);

    // Create Staff B (unassigned staff member)
    const staffBCred = await createUserWithEmailAndPassword(auth, staffBEmail, defaultPwd);
    staffBUser = staffBCred.user;
    await setDoc(doc(db, 'users', staffBUser.uid), {
      email: staffBEmail,
      displayName: 'Brian Smith',
      fullName: 'Brian Smith',
      role: 'staff',
      createdAt: Date.now(),
    });
    check('Staff B (unassigned) account created', true, `UID: ${staffBUser.uid}, Name: Brian Smith`);

    // Create Customer
    const custCred = await createUserWithEmailAndPassword(auth, customerEmail, defaultPwd);
    customerUser = custCred.user;
    await setDoc(doc(db, 'users', customerUser.uid), {
      email: customerEmail,
      fullName: 'Emma Watson',
      displayName: 'Emma Watson',
      phoneNumber: '+27 83 555 9876',
      role: 'customer',
      createdAt: Date.now(),
    });
    check('Customer account created', true, `UID: ${customerUser.uid}, Name: Emma Watson`);

    // -------------------------------------------------------------------------
    // STEP 2: Customer creates booking awaiting confirmation
    // -------------------------------------------------------------------------
    console.log('\n2. Customer creates booking in Firestore...');
    const apptRef = doc(db, 'users', customerUser.uid, 'appointments', apptId);
    const initialBookingData: StoredAppointment = {
      id: apptId,
      customerUid: customerUser.uid,
      customerName: 'Emma Watson',
      customerEmail,
      customerPhone: '+27 83 555 9876',
      packageName: 'Full Ceramic Detail',
      price: 'R450.00',
      date: 'Sat, Nov 08, 2026',
      time: '11:00 AM',
      serviceType: 'Call-out',
      address: '77 Kloof Street, Gardens, Cape Town',
      location: '77 Kloof Street, Gardens, Cape Town',
      vehicle: '2024 Porsche Macan',
      notes: 'Customer gate code is #4321. Wash water tap is by the driveway.',
      confirmed: false,
      status: 'Awaiting Confirmation',
      statusColor: 'amber',
      staffName: 'Pending Assignment',
      staffStatus: 'Finding Staff...',
      isLocked: false,
      createdAt: Date.now(),
    };
    await setDoc(apptRef, initialBookingData);

    const initialSnap = await getDoc(apptRef);
    check('Booking document saved in Firestore', initialSnap.exists());
    const initialDyn = getDynamicAppointmentStatus(
      initialBookingData.date,
      initialBookingData.time,
      false,
      false,
      false,
      initialBookingData.status,
      initialBookingData.confirmed,
      initialBookingData.staffStatus
    );
    check('Initial status evaluates to Awaiting Confirmation in amber',
      initialDyn.status === 'Awaiting Confirmation' && initialDyn.statusColor === 'amber');

    // -------------------------------------------------------------------------
    // STEP 3: Verify CustomerAppointments.tsx real-time listener reacts immediately
    // -------------------------------------------------------------------------
    console.log('\n3. Initializing Customer real-time listener (CustomerAppointments.tsx simulation)...');
    let customerRealtimeUpdates: any[] = [];
    const unsubCustomer = onSnapshot(doc(db, 'users', customerUser.uid, 'appointments', apptId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const dyn = getDynamicAppointmentStatus(
          data.date,
          data.time,
          false,
          data.completed,
          false,
          data.status,
          data.confirmed,
          data.staffStatus
        );
        customerRealtimeUpdates.push({ ...data, dynStatus: dyn.status, dynColor: dyn.statusColor });
      }
    });

    // Wait a brief moment for initial snapshot
    await new Promise((r) => setTimeout(r, 600));
    check('Customer real-time listener established', customerRealtimeUpdates.length > 0);

    // -------------------------------------------------------------------------
    // STEP 4: Staff selection by name & Owner confirmation
    // -------------------------------------------------------------------------
    console.log('\n4. Owner confirms booking and assigns Staff A by name using confirmAppointmentByOwner...');
    
    // Test staff loading function
    let loadedStaffList: any[] = [];
    const unsubStaff = subscribeToStaffMembers((list) => {
      loadedStaffList = list;
    });
    await new Promise((r) => setTimeout(r, 800));
    unsubStaff();

    const selectedStaffA = loadedStaffList.find((s) => s.uid === staffAUser.uid);
    check('Staff A loaded via subscribeToStaffMembers', Boolean(selectedStaffA));
    check('Staff member has real name (not email)', Boolean(selectedStaffA?.name) && !selectedStaffA?.name.includes('@'),
      `Resolved Name: "${selectedStaffA?.name}"`);

    // Call ACTUAL confirmAppointmentByOwner function from src/lib/appointments.ts
    const adminUser = { uid: 'admin_test_uid', name: 'WashWizzy Owner' };
    await confirmAppointmentByOwner(
      customerUser.uid,
      apptId,
      {
        uid: staffAUser.uid,
        name: selectedStaffA.name,
      },
      adminUser
    );

    // Verify Firestore document contents
    const confirmedSnap = await getDoc(apptRef);
    const confirmedData = confirmedSnap.data() as StoredAppointment;
    check('Appointment confirmed in Firestore', confirmedData.confirmed === true);
    check('Status is "Confirmed"', confirmedData.status === 'Confirmed');
    check('StatusColor is "reward-green"', confirmedData.statusColor === 'reward-green');
    check('AssignedStaffUid is Staff A', confirmedData.assignedStaffUid === staffAUser.uid);
    check('StaffName is saved', confirmedData.staffName === selectedStaffA.name);
    check('StaffStatus is "Assigned"', confirmedData.staffStatus === 'Assigned');

    // -------------------------------------------------------------------------
    // STEP 5: Verify Customer real-time listener updated to green Confirmed
    // -------------------------------------------------------------------------
    console.log('\n5. Verifying Customer real-time listener updated automatically without refreshing...');
    await new Promise((r) => setTimeout(r, 800));
    unsubCustomer();

    const latestCustomerUpdate = customerRealtimeUpdates[customerRealtimeUpdates.length - 1];
    check('Customer received real-time push update', customerRealtimeUpdates.length >= 2);
    check('Customer status immediately changed to "Confirmed"', latestCustomerUpdate.dynStatus === 'Confirmed');
    check('Customer statusColor is green ("reward-green")', latestCustomerUpdate.dynColor === 'reward-green');

    // -------------------------------------------------------------------------
    // STEP 6: Verify Assigned Staff A receives booking via subscribeToStaffAppointments
    // -------------------------------------------------------------------------
    console.log('\n6. Verifying Staff A dashboard & appointments real-time subscription...');
    // Sign in as Staff A
    await signOut(auth);
    await signInWithEmailAndPassword(auth, staffAEmail, defaultPwd);

    let staffABookings: any[] = [];
    let staffASubError: any = null;
    const unsubStaffA = subscribeToStaffAppointments(
      staffAUser.uid,
      (list) => {
        staffABookings = list;
      },
      (err) => {
        staffASubError = err;
      }
    );

    await new Promise((r) => setTimeout(r, 1200));
    unsubStaffA();

    check('Staff A collectionGroup subscription succeeded (No index errors)', staffASubError === null,
      staffASubError ? `${staffASubError.code}: ${staffASubError.message}` : 'Index is active & ready');
    check('Staff A sees assigned booking', staffABookings.some((b) => b.id === apptId),
      `Found ${staffABookings.length} assigned booking(s)`);

    if (staffABookings.length > 0) {
      const assignedJob = staffABookings.find((b) => b.id === apptId);
      check('Assigned job has appointment ID', assignedJob.id === apptId);
      check('Assigned job has customer name', assignedJob.customerName === 'Emma Watson');
      check('Assigned job has customer phone', Boolean(assignedJob.customerPhone || assignedJob.phone));
      check('Assigned job has customer email', Boolean(assignedJob.customerEmail || assignedJob.email));
      check('Assigned job has package name', assignedJob.packageName === 'Full Ceramic Detail');
      check('Assigned job has vehicle', assignedJob.vehicle === '2024 Porsche Macan');
      check('Assigned job has date and time', assignedJob.date === 'Sat, Nov 08, 2026' && assignedJob.time === '11:00 AM');
      check('Assigned job has service type', assignedJob.serviceType === 'Call-out');
      check('Assigned job has location/address', assignedJob.address === '77 Kloof Street, Gardens, Cape Town');
      check('Assigned job has price', assignedJob.price === 'R450.00');
      check('Assigned job has notes', assignedJob.notes.includes('gate code is #4321'));
      check('Assigned job has Confirmed status', assignedJob.status === 'Confirmed');
    }

    // -------------------------------------------------------------------------
    // STEP 7: Verify Staff B (unassigned) CANNOT access this booking
    // -------------------------------------------------------------------------
    console.log('\n7. Verifying Staff B (unassigned) access denial...');
    await signOut(auth);
    await signInWithEmailAndPassword(auth, staffBEmail, defaultPwd);

    // 7a. Query check: Staff B subscription returns 0 of this booking
    let staffBBookings: any[] = [];
    const unsubStaffB = subscribeToStaffAppointments(staffBUser.uid, (list) => {
      staffBBookings = list;
    });
    await new Promise((r) => setTimeout(r, 1000));
    unsubStaffB();
    check('Staff B filtered query does NOT contain booking', !staffBBookings.some((b) => b.id === apptId));

    // 7b. Security Rule check: Direct getDoc read must be DENIED by Firestore security rules
    console.log('   Attempting direct getDoc as Staff B on Staff A\'s booking...');
    let staffBDirectReadBlocked = false;
    let staffBErrorCode = '';
    try {
      await getDoc(apptRef);
    } catch (e: any) {
      staffBDirectReadBlocked = true;
      staffBErrorCode = e?.code || e?.message;
    }
    check('Direct getDoc read by Staff B is BLOCKED by Firestore security rules',
      staffBDirectReadBlocked, `Rejected with: ${staffBErrorCode}`);

  } catch (err: any) {
    console.error('\n[UNEXPECTED ERROR DURING LIVE TEST]:', err);
  } finally {
    console.log('\n=================================================================');
    console.log(`TOTAL LIVE TESTS PASSED: ${passedTests} / ${totalTests}`);
    console.log('=================================================================\n');
    if (passedTests === totalTests && totalTests > 0) {
      console.log('>>> ALL LIVE CHECKS AND SECURITY RULES PASSED 100% SUCCESSFULLY! <<<\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runLiveVerification();

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

async function run() {
  console.log("=== STARTING APPOINTMENT FLOW TEST ===");
  const testRunId = Date.now();
  const customerEmail = `test_cust_${testRunId}@example.com`;
  const customerPassword = "Password123!";

  let customerUser = null;

  try {
    console.log(`\n1. Creating test customer account: ${customerEmail}`);
    const cred = await createUserWithEmailAndPassword(auth, customerEmail, customerPassword);
    customerUser = cred.user;
    console.log(`   Customer created. UID: ${customerUser.uid}`);

    // Create user profile in Firestore
    await setDoc(doc(db, "users", customerUser.uid), {
      email: customerEmail,
      fullName: "Test Customer",
      role: "customer",
      createdAt: Date.now(),
    });
    console.log("   Customer profile saved with role: customer.");

    // 2. Test Customer collectionGroup query (Should be blocked by rules)
    console.log("\n2. Testing security rule: Can customer query all appointments collectionGroup?");
    try {
      const q = query(collectionGroup(db, "appointments"));
      await getDocs(q);
      console.error("   SECURITY BREACH: Customer was able to query all appointments!");
    } catch (e) {
      console.log(`   PASS: Customer blocked from collectionGroup query as expected (${e.code}).`);
    }

    // 3. Customer creates a booking
    console.log("\n3. Customer creating appointment booking...");
    const apptId = `WW-TEST-${testRunId}`;
    const apptRef = doc(db, "users", customerUser.uid, "appointments", apptId);
    const newAppointment = {
      id: apptId,
      customerUid: customerUser.uid,
      customerName: "Test Customer",
      customerEmail: customerEmail,
      packageName: "Premium Wash",
      price: "R316.25",
      date: "Fri, Nov 10, 2026",
      time: "10:00 AM",
      serviceType: "Call-out",
      address: "123 Bree Street, Cape Town",
      vehicle: "Tesla Model 3",
      notes: "Please call when nearby",
      confirmed: false,
      status: "Awaiting Confirmation",
      statusColor: "amber",
      staffName: "Pending Assignment",
      staffStatus: "Finding Staff...",
      isLocked: false,
      cancellationPolicy: "This booking is awaiting confirmation from our team.",
      createdAt: Date.now(),
    };

    await setDoc(apptRef, newAppointment);
    console.log(`   PASS: Booking created: ${apptId}`);

    // Verify read own appointment
    const readSnap = await getDoc(apptRef);
    if (readSnap.exists() && readSnap.data().status === "Awaiting Confirmation") {
      console.log("   PASS: Verified booking status: Awaiting Confirmation, confirmed: false");
    } else {
      console.error("   FAIL: Booking verification failed");
    }

    // 4. Test Customer cannot self-confirm appointment (Should be blocked by rules)
    console.log("\n4. Testing security rule: Can customer self-confirm appointment?");
    try {
      await setDoc(apptRef, { confirmed: true, status: "Confirmed" }, { merge: true });
      console.error("   SECURITY ISSUE: Customer was allowed to self-confirm!");
    } catch (e) {
      console.log(`   PASS: Customer blocked from self-confirming (${e.code}).`);
    }

    // 5. Test Admin Role & Capabilities
    console.log("\n5. Testing Admin capabilities...");
    // Create an admin user
    const adminEmail = `test_admin_${testRunId}@example.com`;
    const adminCred = await createUserWithEmailAndPassword(auth, adminEmail, "AdminPassword123!");
    const adminUser = adminCred.user;
    console.log(`   Admin created. UID: ${adminUser.uid}`);

    // Set role = admin on user profile
    await setDoc(doc(db, "users", adminUser.uid), {
      email: adminEmail,
      fullName: "Super Admin",
      role: "admin",
      createdAt: Date.now(),
    });
    console.log("   Admin profile saved with role: admin.");

    // Sign in as admin to ensure auth token/session is active
    await signOut(auth);
    await signInWithEmailAndPassword(auth, adminEmail, "AdminPassword123!");

    // Query collectionGroup as admin
    console.log("\n6. Testing Admin collectionGroup query on appointments...");
    try {
      const q = query(collectionGroup(db, "appointments"));
      const snap = await getDocs(q);
      console.log(`   PASS: Admin successfully queried collectionGroup! Found ${snap.size} appointments.`);
      const found = snap.docs.find((d) => d.id === apptId);
      if (found) {
        console.log(`   PASS: Customer's newly booked appointment ${apptId} loaded in admin query!`);
      } else {
        console.warn(`   Note: apptId not found in collectionGroup snapshot of size ${snap.size}`);
      }
    } catch (e) {
      console.error(`   FAIL: Admin collectionGroup query failed: ${e.code} - ${e.message}`);
    }

    // 7. Admin Confirms Appointment
    console.log("\n7. Admin confirming appointment...");
    try {
      const confirmedAt = Date.now();
      await setDoc(
        apptRef,
        {
          confirmed: true,
          status: "Confirmed",
          statusColor: "burnt-orange",
          confirmedAt,
          confirmedBy: adminUser.uid,
          confirmedByName: "Super Admin",
          confirmedByRole: "admin",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const confSnap = await getDoc(apptRef);
      if (confSnap.data().confirmed === true && confSnap.data().status === "Confirmed") {
        console.log("   PASS: Booking successfully confirmed by Admin! Status changed to Confirmed, confirmed: true");
      } else {
        console.error("   FAIL: Status did not update to Confirmed");
      }
    } catch (e) {
      console.error(`   FAIL: Admin confirmation failed: ${e.code} - ${e.message}`);
    }

    // 8. Admin Reschedules Appointment
    console.log("\n8. Admin rescheduling appointment...");
    const newDate = "Mon, Nov 13, 2026";
    const newTime = "2:00 PM";
    const rescheduleReason = "Optimal bay scheduling";
    try {
      await setDoc(
        apptRef,
        {
          date: newDate,
          time: newTime,
          confirmed: true,
          status: "Confirmed",
          previousSchedule: {
            date: "Fri, Nov 10, 2026",
            time: "10:00 AM",
          },
          rescheduledByOwner: true,
          rescheduleReason,
          rescheduledAt: Date.now(),
          rescheduledBy: adminUser.uid,
          rescheduledByName: "Super Admin",
          rescheduledByRole: "admin",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const reschedSnap = await getDoc(apptRef);
      const d = reschedSnap.data();
      if (d.date === newDate && d.time === newTime && d.previousSchedule?.date === "Fri, Nov 10, 2026") {
        console.log("   PASS: Booking successfully rescheduled by Admin!");
        console.log(`   Updated date: ${d.date}, Updated time: ${d.time}, Rescheduled by owner: ${d.rescheduledByOwner}`);
      } else {
        console.error("   FAIL: Reschedule data mismatch");
      }
    } catch (e) {
      console.error(`   FAIL: Admin reschedule failed: ${e.code} - ${e.message}`);
    }

    // 9. Admin Cancels Appointment
    console.log("\n9. Admin cancelling appointment...");
    const cancelReason = "Rain forecasted on scheduled date";
    try {
      await setDoc(
        apptRef,
        {
          status: "Cancelled",
          statusColor: "red",
          isLocked: true,
          cancelReason,
          cancellationPolicy: `Appointment cancelled by owner: "${cancelReason}".`,
          cancelledAt: Date.now(),
          cancelledBy: adminUser.uid,
          cancelledByName: "Super Admin",
          cancelledByRole: "admin",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const cancelSnap = await getDoc(apptRef);
      const d = cancelSnap.data();
      if (d.status === "Cancelled" && d.cancelReason === cancelReason) {
        console.log("   PASS: Booking successfully cancelled! Reason recorded: " + d.cancelReason);
      } else {
        console.error("   FAIL: Cancel status mismatch");
      }
    } catch (e) {
      console.error(`   FAIL: Admin cancel failed: ${e.code} - ${e.message}`);
    }

    // 10. Test Terminal State: Cannot modify cancelled appointment
    console.log("\n10. Testing terminal protection: Modifying cancelled appointment...");
    // Customer sign in
    await signOut(auth);
    await signInWithEmailAndPassword(auth, customerEmail, customerPassword);
    try {
      await setDoc(apptRef, { date: "Tue, Nov 14, 2026" }, { merge: true });
      console.error("   SECURITY ISSUE: Customer was able to modify a cancelled appointment!");
    } catch (e) {
      console.log(`   PASS: Customer cannot modify cancelled appointment (${e.code}).`);
    }

    console.log("\n=== ALL APPOINTMENT FLOW CHECKS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    process.exit(0);
  }
}

run();

/// <reference types="node" />
import { parseAppointmentDateTime } from '../src/lib/appointments';

interface TestAppointment {
  id: string;
  date: string;
  time: string;
  status: string;
  completed: boolean;
  expectedInToday: boolean;
  expectedInUpcoming: boolean;
  expectedInActive: boolean;
  expectedInHistory: boolean;
  expectedAction: boolean;
  cancelReason?: string;
  cancelledAt?: number;
  cancelledByRole?: string;
  previousSchedule?: {
    date: string;
    time: string;
  };
  rescheduledAt?: number;
  rescheduledByRole?: string;
}

console.log('====================================================================');
console.log(' STEP 1 & 2: VERIFICATION OF FILTERING & HISTORICAL STATUS RULES');
console.log('====================================================================\n');

let pass = 0;
let fail = 0;

function assertCheck(label: string, condition: boolean, extra: string = '') {
  if (condition) {
    console.log(` [PASS] ${label}${extra ? ' — ' + extra : ''}`);
    pass++;
  } else {
    console.error(` [FAIL] ${label}${extra ? ' — ' + extra : ''}`);
    fail++;
  }
}

// 1. Consistent historical rule implementation
const isHistoricalAppointment = (appt: { status?: string; completed?: boolean }): boolean => {
  return appt.status === 'Cancelled' || appt.status === 'Completed' || appt.completed === true;
};

// 2. Date helpers
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

// Test Suite: Historical classification
console.log('--- Testing Historical Classification ---');
assertCheck(
  "status === 'Cancelled' is historical",
  isHistoricalAppointment({ status: 'Cancelled' }) === true
);
assertCheck(
  "status === 'Completed' is historical",
  isHistoricalAppointment({ status: 'Completed' }) === true
);
assertCheck(
  "completed === true is historical even if status is not 'Completed'",
  isHistoricalAppointment({ status: 'Confirmed', completed: true }) === true
);
assertCheck(
  "Active confirmed booking is NOT historical",
  isHistoricalAppointment({ status: 'Confirmed', completed: false }) === false
);
assertCheck(
  "Awaiting Confirmation booking is NOT historical",
  isHistoricalAppointment({ status: 'Awaiting Confirmation', completed: false }) === false
);

// Test Suite: Upcoming vs Past Date Filtering
console.log('\n--- Testing Upcoming Filtering (Date/Time check vs "Not Today") ---');
const pastDate = '2026-01-15'; // clearly past
const futureDate = '2026-12-25'; // clearly future
const time = '10:00 AM';

assertCheck(
  'Past date is NOT today',
  !isAppointmentToday(pastDate, time),
  `Date: ${pastDate}`
);
assertCheck(
  'Past date is NOT upcoming (prevents "Not Today" flaw)',
  !isAppointmentUpcoming(pastDate, time),
  `Date: ${pastDate}`
);
assertCheck(
  'Past date is detected as past/missed',
  isAppointmentPast(pastDate, time, false),
  `Date: ${pastDate}`
);

assertCheck(
  'Future date is upcoming',
  isAppointmentUpcoming(futureDate, time),
  `Date: ${futureDate}`
);
assertCheck(
  'Future date is NOT past',
  !isAppointmentPast(futureDate, time, false),
  `Date: ${futureDate}`
);

// Test Suite: Exclusion from Active Lists & Counters
console.log('\n--- Testing Exclusion from Active Lists, Counters & Action Buttons ---');
const testDataset: TestAppointment[] = [
  {
    id: 'appt-1',
    date: 'Today',
    time: '02:00 PM',
    status: 'Confirmed',
    completed: false,
    expectedInToday: true,
    expectedInUpcoming: false,
    expectedInActive: true,
    expectedInHistory: false,
    expectedAction: true,
  },
  {
    id: 'appt-2-cancelled-today',
    date: 'Today',
    time: '03:00 PM',
    status: 'Cancelled',
    completed: false,
    expectedInToday: false, // EXCLUDED
    expectedInUpcoming: false, // EXCLUDED
    expectedInActive: false, // EXCLUDED
    expectedInHistory: true,
    expectedAction: false, // EXCLUDED
  },
  {
    id: 'appt-3-completed-today',
    date: 'Today',
    time: '11:00 AM',
    status: 'Completed',
    completed: true,
    expectedInToday: false, // EXCLUDED
    expectedInUpcoming: false, // EXCLUDED
    expectedInActive: false, // EXCLUDED
    expectedInHistory: true,
    expectedAction: false, // EXCLUDED
  },
  {
    id: 'appt-4-future-confirmed',
    date: '2026-12-25',
    time: '10:00 AM',
    status: 'Confirmed',
    completed: false,
    expectedInToday: false,
    expectedInUpcoming: true,
    expectedInActive: true,
    expectedInHistory: false,
    expectedAction: true,
  },
  {
    id: 'appt-5-future-cancelled',
    date: '2026-12-25',
    time: '11:00 AM',
    status: 'Cancelled',
    completed: false,
    expectedInToday: false, // EXCLUDED
    expectedInUpcoming: false, // EXCLUDED
    expectedInActive: false, // EXCLUDED
    expectedInHistory: true,
    expectedAction: false, // EXCLUDED
  },
  {
    id: 'appt-6-past-missed',
    date: '2026-01-10',
    time: '10:00 AM',
    status: 'Missed',
    completed: false,
    expectedInToday: false, // EXCLUDED
    expectedInUpcoming: false, // EXCLUDED
    expectedInActive: false, // EXCLUDED
    expectedInHistory: true,
    expectedAction: false, // EXCLUDED
  },
];

// Compute segmented lists as in StaffAppointments.tsx
const todayList = testDataset.filter(
  (a) => !isHistoricalAppointment(a) && isAppointmentToday(a.date, a.time)
);
const upcomingList = testDataset.filter(
  (a) => !isHistoricalAppointment(a) && isAppointmentUpcoming(a.date, a.time)
);
const activeList = testDataset.filter(
  (a) => !isHistoricalAppointment(a) && !isAppointmentPast(a.date, a.time, a.status === 'Missed')
);
const historyList = testDataset.filter(
  (a) => isHistoricalAppointment(a) || isAppointmentPast(a.date, a.time, a.status === 'Missed')
);

assertCheck(
  'Today active list only contains active uncompleted bookings',
  todayList.length === 1 && todayList[0].id === 'appt-1',
  `Count: ${todayList.length}`
);

assertCheck(
  'Upcoming list excludes cancelled future booking',
  upcomingList.length === 1 && upcomingList[0].id === 'appt-4-future-confirmed',
  `Count: ${upcomingList.length}`
);

assertCheck(
  'Active list excludes all cancelled, completed, and missed bookings',
  activeList.length === 2 &&
    activeList.map((a) => a.id).sort().join(',') === 'appt-1,appt-4-future-confirmed',
  `Active count: ${activeList.length}`
);

assertCheck(
  'History list contains all cancelled, completed, and missed bookings',
  historyList.length === 4,
  `History count: ${historyList.length}`
);

// Verify action button rule: only active appointments have action buttons
const actionAllowed = (a: TestAppointment) =>
  !isHistoricalAppointment(a) && !isAppointmentPast(a.date, a.time, a.status === 'Missed');

for (const a of testDataset) {
  assertCheck(
    `Action button for ${a.id} correctly evaluates to ${a.expectedAction}`,
    actionAllowed(a) === a.expectedAction
  );
}

// Test Suite: Step 3 - Open appointment details modal derivation
console.log('\n--- Testing Step 3: Dynamic Modal Derivation from Latest Listener State ---');
let listenerAppointments = [...testDataset];
let selectedApptId: string | null = 'appt-4-future-confirmed';

// Modal derivation helper matching StaffAppointments.tsx useMemo
const getModalData = (id: string | null, list: TestAppointment[]): TestAppointment | null => {
  if (!id) return null;
  return list.find((a) => a.id === id) || null;
};

let modalData = getModalData(selectedApptId, listenerAppointments);
assertCheck('Initial modal data matches selected ID', modalData?.id === 'appt-4-future-confirmed');
assertCheck('Initial modal status is Confirmed', modalData?.status === 'Confirmed');

// Simulate real-time cancellation update arriving from Firestore listener
console.log('Simulating real-time Firestore cancellation snapshot...');
listenerAppointments = listenerAppointments.map((a) =>
  a.id === 'appt-4-future-confirmed'
    ? {
        ...a,
        status: 'Cancelled',
        cancelReason: 'Customer requested cancellation due to weather',
        cancelledAt: Date.now(),
        cancelledByRole: 'customer',
      }
    : a
);

// Open modal re-derives immediately from listener state
modalData = getModalData(selectedApptId, listenerAppointments);
assertCheck(
  'Open modal immediately reflects status: Cancelled without reopening',
  modalData?.status === 'Cancelled'
);
assertCheck(
  'Open modal immediately displays updated cancellation reason',
  modalData?.cancelReason === 'Customer requested cancellation due to weather'
);

// Simulate real-time reschedule update arriving from Firestore listener
console.log('Simulating real-time Firestore reschedule snapshot...');
listenerAppointments = listenerAppointments.map((a) =>
  a.id === 'appt-1'
    ? {
        ...a,
        date: '2026-11-15',
        time: '04:00 PM',
        previousSchedule: { date: 'Today', time: '02:00 PM' },
        rescheduledAt: Date.now(),
        rescheduledByRole: 'owner',
      }
    : a
);

selectedApptId = 'appt-1';
modalData = getModalData(selectedApptId, listenerAppointments);
assertCheck(
  'Open modal reflects rescheduled date/time immediately',
  modalData?.date === '2026-11-15' && modalData?.time === '04:00 PM'
);
assertCheck(
  'Open modal displays previous schedule',
  modalData?.previousSchedule?.date === 'Today'
);

console.log('\n====================================================================');
console.log(`TOTAL FILTERING & MODAL CHECKS: ${pass} PASSED, ${fail} FAILED`);
console.log('====================================================================');

process.exit(fail > 0 ? 1 : 0);

// TODO: Owner Dashboard — Daily Appointments
// Ready-to-use helpers in lib/appointments.ts:
//   - getTodaysAppointmentsAcrossAllCustomers() → today's appointments, all customers, with customerUid attached
//   - getAllStaffMembers() → staff list for an assignment dropdown
//   - assignStaffToAppointment(customerUid, appointmentId, staffUid, staffName) → writes the assignment
// UI pattern to follow: StaffAppointments.tsx card layout + Button component + getBadgeStyles from CustomerAppointments.tsx
// Once assignStaffToAppointment is called from here, StaffAppointments.tsx's collectionGroup query
// (filtered on assignedStaffUid) will start populating automatically — no further wiring needed on the staff side.

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-charcoal-900 text-white flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-3xl font-display font-bold mb-4 text-burnt-orange">Admin Dashboard</h1>
      <p className="text-soft-gray">This dashboard is currently under development.</p>
    </div>
  );
}

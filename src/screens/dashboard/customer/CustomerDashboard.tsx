import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import {
  Calendar,
  Clock,
  Car,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  CalendarDays,
  Crown,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import {
  getStoredAppointments,
  getDynamicAppointmentStatus,
  getAppointmentsStorageKey,
  type StoredAppointment,
} from '../../../lib/appointments';
import { Button } from '../../../components/ui/Button';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [appointments, setAppointments] = useState<StoredAppointment[]>(() => {
    if (currentUser?.uid) {
      return getStoredAppointments(currentUser.uid);
    }
    return [];
  });
  const [hasMembership, setHasMembership] = useState<boolean>(() => {
    if (!currentUser?.uid) return false;
    const cached = localStorage.getItem(`ww_has_membership_${currentUser.uid}`);
    return cached ? JSON.parse(cached) : false;
  });

  const uid = currentUser?.uid;

  // Real-time Firestore sync for customer's appointments
  useEffect(() => {
    if (!uid) {
      setAppointments([]);
      return;
    }

    const apptsRef = collection(db, 'users', uid, 'appointments');
    const q = query(apptsRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: StoredAppointment[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as StoredAppointment);
        });
        setAppointments(list);
        try {
          localStorage.setItem(getAppointmentsStorageKey(uid), JSON.stringify(list));
        } catch {}
      },
      (err) => {
        console.warn('Customer dashboard appointments sync note:', err.message);
      }
    );

    return () => unsub();
  }, [uid]);

  // Real-time membership sync
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        const mem = snap.data()?.hasMembership === true;
        setHasMembership(mem);
        try {
          localStorage.setItem(`ww_has_membership_${uid}`, JSON.stringify(mem));
        } catch {}
      }
    });
    return () => unsub();
  }, [uid]);

  const displayName = currentUser?.displayName || 'Valued Customer';
  const firstName = displayName.split(' ')[0] || 'Customer';

  // Find next upcoming appointment
  const upcomingAppointments = appointments.filter((appt) => {
    const dyn = getDynamicAppointmentStatus(
      appt.date,
      appt.time,
      appt.status === 'Missed',
      appt.completed,
      hasMembership,
      appt.status,
      appt.confirmed,
      appt.staffStatus
    );
    return dyn.status !== 'Missed' && dyn.status !== 'Completed' && dyn.status !== 'Cancelled';
  });

  const awaitingConfirmationCount = appointments.filter((appt) => {
    const dyn = getDynamicAppointmentStatus(
      appt.date,
      appt.time,
      appt.status === 'Missed',
      appt.completed,
      hasMembership,
      appt.status,
      appt.confirmed,
      appt.staffStatus
    );
    return dyn.status === 'Awaiting Confirmation' || appt.confirmed === false;
  }).length;

  const confirmedCount = appointments.filter((appt) => {
    const dyn = getDynamicAppointmentStatus(
      appt.date,
      appt.time,
      appt.status === 'Missed',
      appt.completed,
      hasMembership,
      appt.status,
      appt.confirmed,
      appt.staffStatus
    );
    return dyn.status === 'Confirmed' && appt.status !== 'Cancelled' && !appt.completed;
  }).length;

  const completedCount = appointments.filter((appt) => appt.completed || appt.status === 'Completed').length;

  const nextAppointment = upcomingAppointments[0];

  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards text-[#F5F5F5] transition-colors duration-300 font-sans">
      {/* ── Welcome Banner ── */}
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#E86A33]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E86A33]/15 text-[#E86A33] border border-[#E86A33]/30">
              Customer Portal
            </span>
            {hasMembership && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30 flex items-center gap-1">
                <Crown className="w-3 h-3" />
                VIP Member
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#F5F5F5]">
            Welcome back, {firstName}!
          </h1>
          <p className="text-sm text-[#A1A1AA] max-w-xl leading-relaxed">
            Track your car wash bookings in real time, view appointment confirmations from the owner, and manage your vehicle care.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <Button
            variant="primary"
            onClick={() => navigate('/dashboard/customer/packages')}
            className="gap-2 shadow-md shadow-[#E86A33]/15 text-sm py-2.5 px-4"
          >
            <Sparkles className="w-4 h-4" />
            Book New Wash
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/customer/appointments')}
            className="!border-[#2C2C2C] !text-[#F5F5F5] hover:!border-[#E86A33] text-sm py-2.5 px-4"
          >
            My Appointments
          </Button>
        </div>
      </div>

      {/* ── Metrics Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-[#71717A] font-medium">Upcoming Bookings</span>
          <span className="text-2xl font-bold font-display text-[#F5F5F5] mt-1">
            {upcomingAppointments.length}
          </span>
          <span className="text-[11px] text-[#A1A1AA]">Active wash requests</span>
        </div>

        <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400 font-medium">Awaiting Confirmation</span>
            {awaitingConfirmationCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <span className="text-2xl font-bold font-display text-amber-400 mt-1">
            {awaitingConfirmationCount}
          </span>
          <span className="text-[11px] text-[#A1A1AA]">Pending owner approval</span>
        </div>

        <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-[#35B86B] font-medium">Confirmed Bookings</span>
          <span className="text-2xl font-bold font-display text-[#35B86B] mt-1">
            {confirmedCount}
          </span>
          <span className="text-[11px] text-[#A1A1AA]">Ready on schedule</span>
        </div>

        <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-[#35B86B] font-medium">Completed Washes</span>
          <span className="text-2xl font-bold font-display text-[#35B86B] mt-1">
            {completedCount}
          </span>
          <span className="text-[11px] text-[#A1A1AA]">Lifetime clean rides</span>
        </div>
      </div>

      {/* ── Next Appointment Section (Live Updated) ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-display text-[#F5F5F5] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#E86A33]" />
            Next Scheduled Appointment
          </h2>
          <Link
            to="/dashboard/customer/appointments"
            className="text-xs font-semibold text-[#E86A33] hover:text-[#ff8250] flex items-center gap-1 transition-colors"
          >
            View all ({appointments.length}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {nextAppointment ? (
          <div className="bg-[#171717] border border-[#2C2C2C] hover:border-[#E86A33]/40 rounded-2xl p-6 flex flex-col gap-5 transition-colors shadow-sm">
            {/* Top row: Status, Service Type, Reference, Price */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2C2C2C] pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {nextAppointment.confirmed === false || nextAppointment.status === 'Awaiting Confirmation' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                    <Clock className="w-3.5 h-3.5" />
                    Awaiting Confirmation
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirmed by Owner
                  </span>
                )}

                {nextAppointment.serviceType && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-[#101010] text-[#D4D4D4] border border-[#2C2C2C] font-medium">
                    {nextAppointment.serviceType}
                  </span>
                )}

                {nextAppointment.rescheduledByOwner && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-[#E86A33]/15 text-[#E86A33] border border-[#E86A33]/30 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Rescheduled by owner
                  </span>
                )}
              </div>

              <span className="text-xl font-bold font-display text-[#F5F5F5]">
                {nextAppointment.price}
              </span>
            </div>

            {/* Notification Callout if Awaiting Confirmation */}
            {(nextAppointment.confirmed === false || nextAppointment.status === 'Awaiting Confirmation') && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Your appointment request is awaiting owner review. When confirmed, this card will update automatically and you will receive an in-app notification.
                </p>
              </div>
            )}

            {/* Reschedule Reason Callout if rescheduled by owner */}
            {nextAppointment.rescheduledByOwner && nextAppointment.rescheduleReason && (
              <div className="p-3.5 rounded-xl bg-[#E86A33]/10 border border-[#E86A33]/30 flex items-start gap-2.5 text-xs text-[#F5F5F5]">
                <Sparkles className="w-4 h-4 text-[#E86A33] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#E86A33]">Owner Reschedule Note: </span>
                  "{nextAppointment.rescheduleReason}"
                </div>
              </div>
            )}

            {/* Appointment Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#71717A] font-medium">Package</span>
                <span className="text-sm font-semibold text-[#F5F5F5]">{nextAppointment.packageName}</span>
                <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] mt-1">
                  <Car className="w-3.5 h-3.5 text-[#E86A33]" />
                  <span>{nextAppointment.vehicle}</span>
                </div>
                {nextAppointment.confirmed && nextAppointment.staffName && nextAppointment.staffName !== 'Pending Assignment' && (
                  <div className="flex items-center gap-1.5 text-xs text-[#35B86B] mt-1 font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-[#35B86B]" />
                    <span>Assigned: <strong className="text-[#F5F5F5]">{nextAppointment.staffName}</strong></span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#71717A] font-medium">Scheduled Time</span>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#F5F5F5]">
                  <Calendar className="w-4 h-4 text-[#E86A33]" />
                  <span>{nextAppointment.date}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] mt-1">
                  <Clock className="w-3.5 h-3.5 text-[#E86A33]" />
                  <span>{nextAppointment.time}</span>
                </div>
                {nextAppointment.previousSchedule && (
                  <span className="text-[11px] text-[#71717A] line-through mt-0.5">
                    Was: {nextAppointment.previousSchedule.date} at {nextAppointment.previousSchedule.time}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#71717A] font-medium">Service Location</span>
                <div className="flex items-start gap-1.5 text-xs text-[#F5F5F5]">
                  <MapPin className="w-4 h-4 text-[#E86A33] shrink-0 mt-0.5" />
                  <span className="truncate">
                    {nextAppointment.serviceType === 'Drive-in'
                      ? 'Wash Bay Facility'
                      : nextAppointment.address || nextAppointment.location || 'Call-out Address'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2C2C2C]">
              <Button
                variant="outline"
                onClick={() =>
                  navigate('/dashboard/customer/appointments/reschedule', {
                    state: { appointment: nextAppointment },
                  })
                }
                className="!border-[#2C2C2C] !text-[#F5F5F5] hover:!border-[#E86A33] hover:!text-[#E86A33] !text-xs !py-2 !px-3"
              >
                Reschedule
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigate('/dashboard/customer/appointments/cancel', {
                    state: { appointment: nextAppointment },
                  })
                }
                className="!border-[#2C2C2C] !text-[#EF4444] hover:!bg-red-500/10 hover:!border-red-500/40 !text-xs !py-2 !px-3"
              >
                Cancel Booking
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#101010] border border-[#2C2C2C] flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-[#71717A]" />
            </div>
            <h3 className="text-base font-semibold text-[#F5F5F5]">No upcoming bookings</h3>
            <p className="text-xs text-[#A1A1AA] max-w-sm leading-relaxed">
              You don't have any washes scheduled right now. Book an express, premium, or custom detail package anytime.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/dashboard/customer/packages')}
              className="mt-2 !text-xs !py-2 !px-3.5"
            >
              Book an Appointment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

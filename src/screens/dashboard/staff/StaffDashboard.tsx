import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Car,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Check,
  CalendarDays,
  AlertCircle,
  User,
  FileText,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  subscribeToStaffAppointments,
  parseAppointmentDateTime,
  markAppointmentCompleted,
  type StoredAppointment,
} from '../../../lib/appointments';
import { Button } from '../../../components/ui/Button';

export default function StaffDashboard() {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<(StoredAppointment & { customerUid: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Helper to check if an appointment date is today
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

  // Helper to determine if an appointment is historical
  // Consistently historical when: status === 'Cancelled', status === 'Completed', or completed === true
  const isHistoricalAppointment = (appt: { status?: string; completed?: boolean }): boolean => {
    return appt.status === 'Cancelled' || appt.status === 'Completed' || appt.completed === true;
  };

  // Helper to check if an appointment is in the past (missed appointment policy)
  const isAppointmentPast = (dateStr?: string, timeStr?: string, initialIsMissed?: boolean): boolean => {
    if (initialIsMissed) return true;
    if (!dateStr) return false;
    if (isAppointmentToday(dateStr, timeStr)) return false;
    const parsed = parseAppointmentDateTime(dateStr, timeStr);
    return Boolean(parsed && parsed.getTime() < Date.now());
  };

  // Real-time Firestore sync for staff member's assigned appointments
  useEffect(() => {
    if (!currentUser?.uid) {
      setAppointments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const unsubscribe = subscribeToStaffAppointments(
      currentUser.uid,
      (list) => {
        setAppointments(list);
        setIsLoading(false);
        setErrorMessage(null);
      },
      (err) => {
        console.error('Failed to load staff assigned jobs:', err);
        setErrorMessage('Failed to load your assigned bookings. Please check your connection.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleComplete = async (appt: StoredAppointment & { customerUid: string }) => {
    if (!appt.customerUid || !appt.id) return;
    if (
      isHistoricalAppointment(appt) ||
      isAppointmentPast(appt.date, appt.time, appt.status === 'Missed')
    ) {
      console.warn('Cannot mark a historical or past appointment as completed.');
      return;
    }
    if (completingId === appt.id) return;

    setCompletingId(appt.id);
    try {
      await markAppointmentCompleted(appt.customerUid, appt.id);
    } catch (err: any) {
      console.error('Failed to mark appointment completed:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const displayName = currentUser?.displayName || 'Team Member';
  const firstName = displayName.split(' ')[0] || 'Staff';

  const todayAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          !isHistoricalAppointment(appt) &&
          !isAppointmentPast(appt.date, appt.time, appt.status === 'Missed') &&
          isAppointmentToday(appt.date, appt.time)
      ),
    [appointments]
  );

  const activeAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          !isHistoricalAppointment(appt) &&
          !isAppointmentPast(appt.date, appt.time, appt.status === 'Missed')
      ),
    [appointments]
  );

  const completedAppointments = useMemo(
    () => appointments.filter((appt) => appt.completed === true || appt.status === 'Completed'),
    [appointments]
  );

  const historyAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          isHistoricalAppointment(appt) ||
          isAppointmentPast(appt.date, appt.time, appt.status === 'Missed')
      ),
    [appointments]
  );

  const displayedAppointments = activeTab === 'active' ? activeAppointments : historyAppointments;

  return (
    <div className="flex flex-col gap-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards text-[#F5F5F5] font-sans">
      {/* ── Welcome Banner ── */}
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#35B86B]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Staff Operations Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#F5F5F5]">
            Welcome back, {firstName}!
          </h1>
          <p className="text-sm text-[#A1A1AA] max-w-xl leading-relaxed">
            Here are your service jobs assigned directly by the owner. Bookings update automatically in real time.
          </p>
        </div>

        <Link to="/dashboard/staff/appointments" className="relative z-10 shrink-0">
          <Button
            variant="outline"
            className="!border-[#2C2C2C] !text-[#F5F5F5] hover:!border-[#E86A33] hover:!text-[#E86A33] gap-2 !py-2.5 !px-4"
          >
            <CalendarDays className="w-4 h-4 text-[#E86A33]" />
            Full Schedule View
          </Button>
        </Link>
      </div>

      {/* ── Metric Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-5 flex flex-col gap-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
            <span>Today&apos;s Jobs</span>
            <Calendar className="w-4 h-4 text-[#E86A33]" />
          </div>
          <span className="text-2xl font-bold font-display text-[#F5F5F5] mt-1">
            {todayAppointments.length}
          </span>
          <span className="text-[11px] text-[#71717A]">Active jobs for today</span>
        </div>

        <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-5 flex flex-col gap-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#35B86B]">
            <span className="font-semibold">Active & Confirmed</span>
            <CheckCircle2 className="w-4 h-4 text-[#35B86B]" />
          </div>
          <span className="text-2xl font-bold font-display text-[#35B86B] mt-1">
            {activeAppointments.length}
          </span>
          <span className="text-[11px] text-[#71717A]">Pending completion</span>
        </div>

        <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-5 flex flex-col gap-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
            <span>Completed Washes</span>
            <Check className="w-4 h-4 text-[#35B86B]" />
          </div>
          <span className="text-2xl font-bold font-display text-[#F5F5F5] mt-1">
            {completedAppointments.length}
          </span>
          <span className="text-[11px] text-[#71717A]">Jobs successfully finished</span>
        </div>
      </div>

      {/* ── Error Notification ── */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Main Section: Assigned Service Bookings ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#E86A33]" />
            <h2 className="text-lg font-bold font-display text-[#F5F5F5]">
              Assigned Service Bookings
            </h2>
          </div>

          <div className="flex items-center gap-1.5 bg-[#171717] p-1 rounded-xl border border-[#2C2C2C]">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-[#35B86B] text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              }`}
            >
              Active Jobs ({activeAppointments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#E86A33] text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              }`}
            >
              History ({historyAppointments.length})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-12 text-center text-[#A1A1AA] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-[#E86A33] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading your assigned bookings...</span>
          </div>
        ) : displayedAppointments.length === 0 ? (
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-12 text-center text-[#A1A1AA] flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#101010] border border-[#2C2C2C] flex items-center justify-center text-[#71717A]">
              <Calendar className="w-6 h-6 text-[#E86A33]" />
            </div>
            <h3 className="text-base font-semibold text-[#F5F5F5]">
              {activeTab === 'active' ? 'No Active Jobs' : 'No Booking History'}
            </h3>
            <p className="text-xs text-[#71717A] max-w-sm">
              {activeTab === 'active'
                ? 'When the owner confirms a booking and assigns you to the service, it will appear here immediately in real time.'
                : 'Completed and cancelled bookings will be saved here for your historical records.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {displayedAppointments.map((appt) => {
              const isCancelled = appt.status === 'Cancelled';
              const isDone = appt.completed || appt.status === 'Completed';
              const isToday = isAppointmentToday(appt.date, appt.time);
              const isSaving = completingId === appt.id;

              return (
                <div
                  key={appt.id}
                  className={`bg-[#171717] border rounded-2xl p-5 md:p-6 transition-all shadow-sm flex flex-col gap-5 ${
                    isCancelled
                      ? 'border-red-500/30 bg-[#171717]/80'
                      : isDone
                      ? 'border-[#2C2C2C] opacity-80'
                      : 'border-[#2C2C2C] hover:border-[#35B86B]/40'
                  }`}
                >
                  {/* Top Bar: Status Badge, Appointment ID, Service Type, Price */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2C2C2C] pb-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                          <XCircle className="w-3.5 h-3.5" />
                          Cancelled
                        </span>
                      ) : isDone ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirmed
                        </span>
                      )}

                      <span className="font-mono text-xs font-bold text-[#A1A1AA] bg-[#101010] px-2.5 py-1 rounded-lg border border-[#2C2C2C]">
                        #{appt.id}
                      </span>

                      {appt.serviceType && (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-[#101010] text-[#D4D4D4] border border-[#2C2C2C] font-medium">
                          {appt.serviceType}
                        </span>
                      )}

                      {isToday && !isHistoricalAppointment(appt) && !isAppointmentPast(appt.date, appt.time, appt.status === 'Missed') && (
                        <span className="text-[11px] font-semibold text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-full border border-[#35B86B]/20">
                          Today&apos;s Job
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#71717A]">Price</span>
                      <span className="text-lg font-bold font-display text-[#F5F5F5]">
                        {appt.price || 'Standard'}
                      </span>
                    </div>
                  </div>

                  {/* 3-Column Info Cluster */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Customer Column */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                        Customer & Contact
                      </span>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#101010] border border-[#2C2C2C] flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-[#35B86B]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-[#F5F5F5] truncate">
                            {appt.customerName || 'Customer'}
                          </span>
                          {(appt.customerPhone || appt.phone) && (
                            <a
                              href={`tel:${appt.customerPhone || appt.phone}`}
                              className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#35B86B] transition-colors mt-0.5"
                            >
                              <Phone className="w-3 h-3 shrink-0 text-[#71717A]" />
                              <span>{appt.customerPhone || appt.phone}</span>
                            </a>
                          )}
                          {(appt.customerEmail || appt.email) && (
                            <a
                              href={`mailto:${appt.customerEmail || appt.email}`}
                              className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#35B86B] transition-colors mt-0.5 truncate"
                            >
                              <Mail className="w-3 h-3 shrink-0 text-[#71717A]" />
                              <span className="truncate">{appt.customerEmail || appt.email}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Service & Vehicle Column */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                        Service & Vehicle
                      </span>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-[#E86A33] shrink-0" />
                          <span className="text-sm font-medium text-[#F5F5F5] truncate">
                            {appt.vehicle || 'Standard Vehicle'}
                          </span>
                        </div>
                        <span className="text-xs text-[#A1A1AA] pl-6 font-medium">
                          Package: {appt.packageName || 'Wash Service'}
                        </span>
                        {(appt.address || appt.location) && (
                          <div className="flex items-start gap-1.5 text-xs text-[#71717A] pl-6">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#E86A33] mt-0.5" />
                            <span className="truncate">{appt.address || appt.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scheduled Time Column */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                        Scheduled Slot
                      </span>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#F5F5F5]">
                          <Calendar className="w-4 h-4 text-[#35B86B]" />
                          <span>{appt.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA] pl-6">
                          <Clock className="w-3.5 h-3.5 text-[#35B86B]" />
                          <span>{appt.time}</span>
                        </div>
                        {appt.previousSchedule && (
                          <div className="text-[11px] text-[#71717A] pl-6 line-through">
                            Was: {appt.previousSchedule.date} at {appt.previousSchedule.time}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Reason Callout if cancelled */}
                  {isCancelled && appt.cancelReason && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-red-400 font-semibold mr-1.5">Cancellation Reason:</span>
                        &ldquo;{appt.cancelReason}&rdquo;
                      </div>
                    </div>
                  )}

                  {/* Customer Notes Callout if present */}
                  {appt.notes && (
                    <div className="p-3.5 rounded-xl bg-[#101010] border border-[#2C2C2C] text-xs text-[#A1A1AA] flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-[#E86A33] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[#71717A] font-medium mr-1.5">Customer Notes:</span>
                        {appt.notes}
                      </div>
                    </div>
                  )}

                  {/* Bottom Action Row */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#2C2C2C]">
                    <div className="text-xs text-[#71717A]">
                      {isCancelled ? (
                        <span className="text-red-400/90 font-medium flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" /> Cancelled booking (History)
                        </span>
                      ) : isDone ? (
                        <span className="text-[#35B86B] font-medium flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Service completed
                        </span>
                      ) : (
                        <span>Assigned to you by the owner</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      {isHistoricalAppointment(appt) ||
                      isAppointmentPast(appt.date, appt.time, appt.status === 'Missed') ? (
                        <span className="text-xs text-[#71717A] italic py-1.5 px-2">
                          {isCancelled
                            ? 'Protected historical booking'
                            : isDone
                            ? 'Completed'
                            : 'Missed booking'}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          isLoading={isSaving}
                          onClick={() => handleComplete(appt)}
                          className="!py-2 !px-3.5 !text-xs gap-1.5 font-semibold !bg-[#35B86B] hover:!bg-[#2da15d] !text-white cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          Mark Completed
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


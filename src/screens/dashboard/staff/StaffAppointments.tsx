import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Car,
  Info,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  FileText,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import {
  subscribeToStaffAppointments,
  parseAppointmentDateTime,
  markAppointmentCompleted,
} from '../../../lib/appointments';

interface StaffAppointmentItem {
  id: string;
  customerUid: string;
  date: string;
  time: string;
  customerName: string;
  customerEmail?: string;
  phone?: string;
  serviceName: string;
  serviceType?: string;
  badgeColor: string;
  status: string;
  vehicle: string;
  staffName: string;
  assignedStaffUid?: string;
  completed: boolean;
  price?: string;
  location?: string;
  notes?: string;
  cancelReason?: string;
  cancelledAt?: number;
  cancelledByRole?: string;
  previousSchedule?: { date: string; time: string };
}

export default function StaffAppointments() {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<StaffAppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'all' | 'history'>('today');

  // Info modal state: derive from selected ID and dynamic appointments list
  // so cancellations and reschedules update an open modal immediately
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  const infoModalAppt = useMemo(() => {
    if (!selectedApptId) return null;
    return appointments.find((a) => a.id === selectedApptId) || null;
  }, [selectedApptId, appointments]);

  // Badge style resolver consistent with CustomerAppointments.tsx
  const getBadgeStyles = (color?: string, status?: string) => {
    if (status === 'Cancelled' || color === 'red') {
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    }
    switch (color) {
      case 'orange':
      case 'burnt-orange':
        return 'bg-[#E86A33]/15 text-[#E86A33] border-[#E86A33]/30';
      case 'green':
      case 'reward-green':
      default:
        return 'bg-[#35B86B]/15 text-[#35B86B] border-[#35B86B]/30';
    }
  };

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

  // Helper to check if an appointment is upcoming (future date/time after today)
  const isAppointmentUpcoming = (dateStr?: string, timeStr?: string): boolean => {
    if (!dateStr) return false;
    if (isAppointmentToday(dateStr, timeStr)) return false;
    const parsed = parseAppointmentDateTime(dateStr, timeStr);
    return Boolean(parsed && parsed.getTime() > Date.now());
  };

  // Helper to check if an appointment is in the past (missed appointment policy)
  const isAppointmentPast = (dateStr?: string, timeStr?: string, initialIsMissed?: boolean): boolean => {
    if (initialIsMissed) return true;
    if (!dateStr) return false;
    if (isAppointmentToday(dateStr, timeStr)) return false;
    const parsed = parseAppointmentDateTime(dateStr, timeStr);
    return Boolean(parsed && parsed.getTime() < Date.now());
  };

  // Listen in real-time to Firestore collectionGroup appointments for the logged-in staff member
  useEffect(() => {
    if (!currentUser?.uid) {
      setAppointments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = subscribeToStaffAppointments(
      currentUser.uid,
      (list) => {
        const mapped: StaffAppointmentItem[] = list.map((data) => {
          const isCancelled = data.status === 'Cancelled';
          const isDone = data.completed || data.status === 'Completed';

          return {
            id: data.id,
            customerUid: data.customerUid,
            date: data.date || '',
            time: data.time || '',
            customerName: data.customerName || 'Customer',
            customerEmail: data.customerEmail || data.email,
            phone: data.customerPhone || data.phone,
            serviceName: data.packageName || 'Car Wash Service',
            serviceType: data.serviceType || 'Standard',
            badgeColor: isCancelled
              ? 'red'
              : isDone
              ? 'reward-green'
              : data.statusColor || 'reward-green',
            status: isCancelled
              ? 'Cancelled'
              : isDone
              ? 'Completed'
              : data.status || 'Confirmed',
            vehicle: data.vehicle || 'Standard Vehicle',
            staffName: data.staffName || 'Staff',
            assignedStaffUid: data.assignedStaffUid,
            completed: Boolean(data.completed),
            price: data.price,
            location: data.address || data.location,
            notes: data.notes,
            cancelReason: data.cancelReason,
            cancelledAt: data.cancelledAt,
            cancelledByRole: data.cancelledByRole,
            previousSchedule: data.previousSchedule,
          };
        });
        setAppointments(mapped);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to listen to staff appointments:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Client-side segmented lists: strictly keeping historical bookings out of active & upcoming
  const todayAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          !isHistoricalAppointment(appt) &&
          isAppointmentToday(appt.date, appt.time)
      ),
    [appointments]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          !isHistoricalAppointment(appt) &&
          isAppointmentUpcoming(appt.date, appt.time)
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

  const historyAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          isHistoricalAppointment(appt) ||
          isAppointmentPast(appt.date, appt.time, appt.status === 'Missed')
      ),
    [appointments]
  );

  const displayedAppointments = useMemo(() => {
    if (activeTab === 'today') return todayAppointments;
    if (activeTab === 'upcoming') return upcomingAppointments;
    if (activeTab === 'history') return historyAppointments;
    return activeAppointments; // 'all' -> all active assigned jobs
  }, [activeTab, todayAppointments, upcomingAppointments, historyAppointments, activeAppointments]);

  const handleMarkCompleted = async (appt: StaffAppointmentItem) => {
    if (
      isHistoricalAppointment(appt) ||
      isAppointmentPast(appt.date, appt.time, appt.status === 'Missed')
    ) {
      console.warn('Cannot mark a historical or past appointment as completed.');
      return;
    }

    const nextCompleted = !appt.completed;
    // Optimistic local state update
    setAppointments((prev) =>
      prev.map((item) =>
        item.id === appt.id
          ? {
              ...item,
              completed: nextCompleted,
              status: nextCompleted ? 'Completed' : 'Confirmed',
              badgeColor: 'reward-green',
            }
          : item
      )
    );

    if (appt.customerUid) {
      try {
        await markAppointmentCompleted(appt.customerUid, appt.id);
      } catch (err) {
        console.error('Failed to mark appointment completed:', err);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 text-[#F5F5F5] font-sans pb-12">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#E86A33]" />
          <div>
            <h2 className="text-2xl font-bold font-display tracking-tight text-[#F5F5F5]">
              My Assigned Jobs
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Review and manage bookings assigned directly to you by the owner
            </p>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#171717] p-1.5 rounded-xl border border-[#2C2C2C] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'today'
                ? 'bg-[#E86A33] text-white shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            Today ({todayAppointments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-[#E86A33] text-white shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            Upcoming ({upcomingAppointments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#E86A33] text-white shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            All Assigned ({activeAppointments.length})
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

      {/* Confirmed Appointments list */}
      <div className="w-full flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#F5F5F5]">
            {activeTab === 'today'
              ? "Today's Schedule"
              : activeTab === 'upcoming'
              ? 'Upcoming Scheduled Bookings'
              : activeTab === 'history'
              ? 'Booking History & Cancellations'
              : 'All Assigned Active Bookings'}
          </h3>
          <span className="text-sm text-[#71717A]">
            {displayedAppointments.length}{' '}
            {displayedAppointments.length === 1 ? 'Booking' : 'Bookings'}
          </span>
        </div>

        {/* Cards List */}
        {isLoading ? (
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-8 text-center text-[#A1A1AA]">
            Loading schedule...
          </div>
        ) : displayedAppointments.length > 0 ? (
          <div className="flex flex-col gap-4">
            {displayedAppointments.map((appt) => {
              const isCancelled = appt.status === 'Cancelled';
              const isToday = isAppointmentToday(appt.date, appt.time);

              return (
                <div
                  key={appt.id}
                  className={`bg-[#171717] border rounded-2xl p-5 md:p-6 shadow-sm transition-colors flex flex-col gap-4 ${
                    isCancelled
                      ? 'border-red-500/30 bg-[#171717]/80'
                      : 'border-[#2C2C2C] hover:border-[#35B86B]/40'
                  }`}
                >
                  {/* Row 1: Status, Reference ID, Service Type, Price */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2C2C2C] pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getBadgeStyles(
                          appt.badgeColor,
                          appt.status
                        )}`}
                      >
                        {isCancelled ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {appt.status}
                      </span>

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
                      <span className="text-base font-bold font-display text-[#F5F5F5]">
                        {appt.price || 'Standard'}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Customer info, Vehicle/Package, Schedule */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Customer info */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                        Customer & Contact
                      </span>
                      <span className="font-semibold text-sm text-[#F5F5F5]">
                        {appt.customerName}
                      </span>
                      {appt.phone && (
                        <a
                          href={`tel:${appt.phone}`}
                          className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#35B86B] transition-colors"
                        >
                          <Phone className="w-3 h-3 text-[#71717A]" />
                          <span>{appt.phone}</span>
                        </a>
                      )}
                      {appt.customerEmail && (
                        <a
                          href={`mailto:${appt.customerEmail}`}
                          className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#35B86B] transition-colors truncate"
                        >
                          <Mail className="w-3 h-3 text-[#71717A] shrink-0" />
                          <span className="truncate">{appt.customerEmail}</span>
                        </a>
                      )}
                    </div>

                    {/* Service & Vehicle */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                        Service & Vehicle
                      </span>
                      <div className="flex items-center gap-2">
                        <Car className="w-3.5 h-3.5 text-[#E86A33] shrink-0" />
                        <span className="text-sm font-medium text-[#F5F5F5]">
                          {appt.vehicle}
                        </span>
                      </div>
                      <span className="text-xs text-[#A1A1AA] pl-5.5">
                        Package: {appt.serviceName}
                      </span>
                      {appt.location && (
                        <div className="flex items-start gap-1.5 text-xs text-[#71717A] pl-5.5">
                          <MapPin className="w-3.5 h-3.5 text-[#E86A33] shrink-0 mt-0.5" />
                          <span className="truncate">{appt.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Scheduled Slot */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                        Scheduled Slot
                      </span>
                      <div className="flex items-center gap-2 text-sm font-medium text-[#F5F5F5]">
                        <Calendar className="w-3.5 h-3.5 text-[#35B86B]" />
                        <span>{appt.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#A1A1AA] pl-5.5">
                        <Clock className="w-3.5 h-3.5 text-[#35B86B]" />
                        <span>{appt.time}</span>
                      </div>
                      {appt.previousSchedule && (
                        <div className="text-[11px] text-[#71717A] pl-5.5 line-through">
                          Was: {appt.previousSchedule.date} at {appt.previousSchedule.time}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cancellation Reason if cancelled */}
                  {isCancelled && appt.cancelReason && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-red-400 font-semibold mr-1.5">Cancellation Reason:</span>
                        &ldquo;{appt.cancelReason}&rdquo;
                      </div>
                    </div>
                  )}

                  {/* Customer notes preview if present */}
                  {appt.notes && (
                    <div className="p-3 rounded-xl bg-[#101010] border border-[#2C2C2C] text-xs text-[#A1A1AA] flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-[#E86A33] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[#71717A] font-medium mr-1.5">Customer Notes:</span>
                        {appt.notes}
                      </div>
                    </div>
                  )}

                  {/* Row 3: Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#2C2C2C]">
                    <span className="text-xs text-[#71717A]">
                      {isCancelled ? (
                        <span className="text-red-400/90 font-medium flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" /> Cancelled booking (History)
                        </span>
                      ) : (appt.completed || appt.status === 'Completed') ? (
                        <span className="text-[#35B86B] font-medium flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Wash service completed
                        </span>
                      ) : isAppointmentPast(appt.date, appt.time, appt.status === 'Missed') ? (
                        <span className="text-red-400 font-medium flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Missed booking
                        </span>
                      ) : (
                        'Ready for service'
                      )}
                    </span>

                    <div className="flex items-center gap-2.5">
                      {isHistoricalAppointment(appt) ||
                      isAppointmentPast(appt.date, appt.time, appt.status === 'Missed') ? (
                        <span className="text-xs text-[#71717A] italic py-1 px-2">
                          {isCancelled
                            ? 'Protected history'
                            : (appt.completed || appt.status === 'Completed')
                            ? 'Completed'
                            : 'Missed booking'}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => handleMarkCompleted(appt)}
                          className="!py-2 !px-3.5 !text-xs font-semibold gap-1.5 !bg-[#35B86B] hover:!bg-[#2da15d] !text-white cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark Completed
                        </Button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedApptId(appt.id)}
                        className="p-2 text-[#71717A] hover:text-[#E86A33] transition-colors rounded-lg hover:bg-[#1F1F1F] cursor-pointer"
                        title="View Full Booking Details"
                        aria-label="View Full Booking Details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-8 text-center text-[#A1A1AA]">
            {activeTab === 'today'
              ? 'No active appointments scheduled for today'
              : activeTab === 'upcoming'
              ? 'No upcoming appointments scheduled'
              : activeTab === 'history'
              ? 'No past or cancelled bookings in your history'
              : 'No active appointments currently assigned to you'}
          </div>
        )}
      </div>

      {/* Appointment Info Modal */}
      {infoModalAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedApptId(null)}
              className="absolute top-4 right-4 p-1 text-[#71717A] hover:text-[#F5F5F5] transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-display text-xl font-bold text-[#F5F5F5] mb-4">
              Booking Details
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Appointment ID</span>
                <span className="font-mono text-xs font-bold text-[#F5F5F5] bg-[#101010] px-2 py-0.5 rounded border border-[#2C2C2C]">
                  #{infoModalAppt.id}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyles(
                    infoModalAppt.badgeColor,
                    infoModalAppt.status
                  )}`}
                >
                  {infoModalAppt.status === 'Cancelled' ? (
                    <XCircle className="w-3 h-3" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  {infoModalAppt.status}
                </span>
              </div>
              {infoModalAppt.cancelReason && (
                <div className="flex flex-col gap-1 py-1.5 border-b border-[#2C2C2C]">
                  <span className="text-red-400 font-medium">Cancellation Reason</span>
                  <span className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 p-2 rounded">
                    &ldquo;{infoModalAppt.cancelReason}&rdquo;
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Customer</span>
                <span className="text-[#F5F5F5] font-medium">
                  {infoModalAppt.customerName}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Contact Phone</span>
                <span className="text-[#F5F5F5] font-mono">
                  {infoModalAppt.phone || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Contact Email</span>
                <span className="text-[#F5F5F5] font-medium truncate max-w-[200px]">
                  {infoModalAppt.customerEmail || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Scheduled Time</span>
                <span className="text-[#F5F5F5] font-medium">
                  {infoModalAppt.date} at {infoModalAppt.time}
                </span>
              </div>
              {infoModalAppt.previousSchedule && (
                <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                  <span className="text-[#A1A1AA]">Previous Time</span>
                  <span className="text-[#71717A] line-through text-xs">
                    {infoModalAppt.previousSchedule.date} at {infoModalAppt.previousSchedule.time}
                  </span>
                </div>
              )}
              {infoModalAppt.serviceType && (
                <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                  <span className="text-[#A1A1AA]">Service Type</span>
                  <span className="text-[#F5F5F5] font-medium">
                    {infoModalAppt.serviceType}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Vehicle</span>
                <span className="text-[#F5F5F5] font-medium">
                  {infoModalAppt.vehicle}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Service Package</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyles(
                    infoModalAppt.badgeColor,
                    infoModalAppt.status
                  )}`}
                >
                  {infoModalAppt.serviceName}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Location</span>
                <span className="text-[#F5F5F5]">
                  {infoModalAppt.location || 'Drive-in Bay'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                <span className="text-[#A1A1AA]">Price</span>
                <span className="text-[#E86A33] font-bold">
                  {infoModalAppt.price || 'Standard'}
                </span>
              </div>
              {infoModalAppt.notes && (
                <div className="bg-[#101010] border border-[#2C2C2C] rounded-lg p-3 mt-2">
                  <span className="text-xs text-[#71717A] block mb-1">Notes:</span>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    {infoModalAppt.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedApptId(null)}
                className="!py-2 !px-4 !text-xs !border-[#2C2C2C] !text-[#F5F5F5]"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

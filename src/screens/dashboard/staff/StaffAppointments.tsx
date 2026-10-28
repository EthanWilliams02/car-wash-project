import { useState, useEffect, useMemo } from 'react';
import {
  collectionGroup,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  Calendar,
  Car,
  Info,
  Check,
  X,
  CalendarDays,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import { parseAppointmentDateTime, markAppointmentCompleted } from '../../../lib/appointments';

interface StaffAppointmentItem {
  id: string;
  customerUid: string;
  docPath: string;
  date: string;
  time: string;
  customerName: string;
  serviceName: string;
  badgeColor: string;
  vehicle: string;
  staffName: string;
  assignedStaffUid?: string;
  completed: boolean;
  price?: string;
  location?: string;
  phone?: string;
  notes?: string;
}

export default function StaffAppointments() {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<StaffAppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'all'>('today');

  // Info modal state
  const [infoModalAppt, setInfoModalAppt] = useState<StaffAppointmentItem | null>(null);

  // Badge style resolver consistent with CustomerAppointments.tsx
  const getBadgeStyles = (color?: string) => {
    switch (color) {
      case 'orange':
      case 'burnt-orange':
        return 'bg-[#E86A33]/15 text-[#E86A33] border-[#E86A33]/30';
      case 'green':
      case 'reward-green':
        return 'bg-[#35B86B]/15 text-[#35B86B] border-[#35B86B]/30';
      default:
        return 'bg-[#1F1F1F] text-[#A1A1AA] border-[#2C2C2C]';
    }
  };

  // Helper to parse time string into bold hour and period (AM/PM)
  const formatTimeDisplay = (timeStr?: string): { hour: string; period: string } => {
    if (!timeStr) return { hour: '--:--', period: '' };
    const startTimePart = timeStr.split('-')[0].trim();
    const match = startTimePart.match(/^(\d{1,2}:\d{2})\s*(AM|PM)?$/i);
    if (match) {
      return {
        hour: match[1],
        period: (match[2] || 'AM').toUpperCase(),
      };
    }
    return { hour: startTimePart, period: '' };
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

  // Listen to Firestore collectionGroup appointments for the logged-in staff member
  useEffect(() => {
    if (!currentUser?.uid) {
      setAppointments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const apptsQuery = query(
      collectionGroup(db, 'appointments'),
      where('assignedStaffUid', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      apptsQuery,
      (snapshot) => {
        const list: StaffAppointmentItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const customerUid = docSnap.ref.parent.parent?.id || '';
          list.push({
            id: docSnap.id,
            customerUid,
            docPath: docSnap.ref.path,
            date: data.date || '',
            time: data.time || '',
            customerName: data.customerName || data.userName || 'Customer',
            serviceName: data.packageName || data.serviceName || 'Car Wash Service',
            badgeColor: data.statusColor || data.badgeColor || 'orange',
            vehicle: data.vehicle || 'Vehicle',
            staffName: data.staffName || 'Staff',
            assignedStaffUid: data.assignedStaffUid,
            completed: Boolean(data.completed),
            price: data.price,
            location: data.address || data.location,
            phone: data.phone || data.userPhone,
            notes: data.notes,
          });
        });
        setAppointments(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to listen to staff appointments via collectionGroup:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Client-side segmented lists
  const todayAppointments = useMemo(
    () => appointments.filter((appt) => isAppointmentToday(appt.date, appt.time)),
    [appointments]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) => !isAppointmentToday(appt.date, appt.time) && !appt.completed
      ),
    [appointments]
  );

  const displayedAppointments = useMemo(() => {
    if (activeTab === 'today') return todayAppointments;
    if (activeTab === 'upcoming') return upcomingAppointments;
    return appointments;
  }, [activeTab, todayAppointments, upcomingAppointments, appointments]);

  const handleMarkCompleted = async (appt: StaffAppointmentItem) => {
    const nextCompleted = !appt.completed;
    // Optimistic local state update
    setAppointments((prev) =>
      prev.map((item) =>
        item.id === appt.id ? { ...item, completed: nextCompleted } : item
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
              Review and manage bookings assigned to you by the owner
            </p>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 bg-[#171717] p-1.5 rounded-xl border border-[#2C2C2C] self-start sm:self-auto">
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
            All Assigned ({appointments.length})
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
              : 'All Assigned Bookings'}
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
              const timeDisplay = formatTimeDisplay(appt.time);
              const isToday = isAppointmentToday(appt.date, appt.time);

              return (
                <div
                  key={appt.id}
                  className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-5 shadow-sm hover:border-[#E86A33]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Left cluster: Time + Scheduled Date + Customer Info + Vehicle */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
                    {/* Time: Bold, stacked AM/PM */}
                    <div className="flex flex-col items-center justify-center min-w-[60px] sm:min-w-[68px] shrink-0 text-center sm:border-r sm:border-[#2C2C2C] sm:pr-4">
                      <span className="text-xl font-bold font-display text-[#F5F5F5] leading-none">
                        {timeDisplay.hour}
                      </span>
                      {timeDisplay.period && (
                        <span className="text-xs font-semibold text-[#A1A1AA] tracking-wider uppercase mt-1">
                          {timeDisplay.period}
                        </span>
                      )}
                    </div>

                    {/* Customer name + service badge + scheduled date */}
                    <div className="flex flex-col gap-1.5 min-w-[150px] shrink-0">
                      <span className="font-semibold text-base text-[#F5F5F5] truncate">
                        {appt.customerName}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyles(
                            appt.badgeColor
                          )}`}
                        >
                          {appt.serviceName}
                        </span>
                        {isToday ? (
                          <span className="text-[11px] font-semibold text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-md border border-[#35B86B]/20">
                            Today
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#A1A1AA] bg-[#101010] px-2 py-0.5 rounded-md border border-[#2C2C2C]">
                            <CalendarDays className="w-3 h-3 text-[#E86A33]" />
                            {appt.date}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Car icon + vehicle model + staff name */}
                    <div className="flex items-center gap-2 text-[#A1A1AA] text-sm flex-1 min-w-0">
                      <Car className="w-4 h-4 shrink-0 text-[#E86A33]" />
                      <span className="truncate text-[#F5F5F5]">{appt.vehicle}</span>
                    </div>
                  </div>

                  {/* Right: Actions cluster */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto ml-auto sm:ml-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleMarkCompleted(appt)}
                      className={`!py-2 !px-3.5 !text-sm !border-[#2C2C2C] transition-colors ${
                        appt.completed
                          ? '!text-[#35B86B] !border-[#35B86B]/50 bg-[#35B86B]/10 hover:!border-[#35B86B]'
                          : '!text-[#F5F5F5] hover:!border-[#35B86B] hover:!text-[#35B86B]'
                      }`}
                    >
                      {appt.completed ? (
                        <span className="flex items-center gap-1.5 text-[#35B86B]">
                          <Check className="w-3.5 h-3.5" />
                          Completed
                        </span>
                      ) : (
                        'Mark Completed'
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setInfoModalAppt(appt)}
                      className="p-2 text-[#71717A] hover:text-[#E86A33] transition-colors rounded-lg hover:bg-[#1F1F1F] cursor-pointer"
                      title="View Appointment Details"
                      aria-label="View Appointment Details"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-8 text-center text-[#A1A1AA]">
            {activeTab === 'today'
              ? 'No appointments scheduled for today'
              : activeTab === 'upcoming'
              ? 'No upcoming appointments scheduled'
              : 'No appointments currently assigned to you'}
          </div>
        )}
      </div>

      {/* Appointment Info Modal */}
      {infoModalAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setInfoModalAppt(null)}
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
                <span className="text-[#A1A1AA]">Scheduled Time</span>
                <span className="text-[#F5F5F5] font-medium">
                  {infoModalAppt.date} at {infoModalAppt.time}
                </span>
              </div>
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
                    infoModalAppt.badgeColor
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
                <span className="text-[#A1A1AA]">Assigned Staff</span>
                <span className="text-[#F5F5F5] font-medium">
                  {infoModalAppt.staffName}
                </span>
              </div>
              {infoModalAppt.price && (
                <div className="flex justify-between py-1.5 border-b border-[#2C2C2C]">
                  <span className="text-[#A1A1AA]">Price</span>
                  <span className="text-[#E86A33] font-bold">
                    {infoModalAppt.price}
                  </span>
                </div>
              )}
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
                onClick={() => setInfoModalAppt(null)}
                className="!py-2 !px-4 !text-sm !border-[#2C2C2C] !text-[#F5F5F5] hover:!border-[#E86A33] hover:!text-[#E86A33]"
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

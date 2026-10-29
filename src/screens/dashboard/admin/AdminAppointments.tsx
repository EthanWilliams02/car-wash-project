
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Car,
  MapPin,
  Search,
  CheckCircle2,
  XCircle,
  CalendarDays,
  User,
  Phone,
  Mail,
  AlertCircle,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  subscribeToAllAppointments,
  subscribeToStaffMembers,
  confirmAppointmentByOwner,
  getDynamicAppointmentStatus,
  type StoredAppointment,
  type StaffMember,
} from '../../../lib/appointments';
import { Button } from '../../../components/ui/Button';

type FilterTab = 'all' | 'awaiting' | 'confirmed' | 'cancelled' | 'completed';

export default function AdminAppointments() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [appointments, setAppointments] = useState<(StoredAppointment & { customerUid: string })[]>([]);
  // null = first load pending, false = not loading, true = loading
  const [isLoading, setIsLoading] = useState(true);
  // null = no error, string = permission or network error message
  const [loadError, setLoadError] = useState<string | null>(null);
  // tracks whether we've ever received a successful snapshot (even empty)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const sortOrder: 'newest' | 'date_asc' | 'date_desc' = 'newest';

  // Confirmation action in-progress tracker: appointmentId -> boolean
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Staff members populated from authoritative pre_registered_staff records
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Selected staff member per appointment: appointmentId -> staffUid
  const [selectedStaffMap, setSelectedStaffMap] = useState<Record<string, string>>({});

  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to real-time staff members list
  useEffect(() => {
    setIsStaffLoading(true);
    setStaffError(null);
    const unsubStaff = subscribeToStaffMembers(
      (list) => {
        setStaffList(list);
        setIsStaffLoading(false);
        setStaffError(null);
      },
      (err) => {
        console.warn('Failed to load real staff members:', err);
        const errMsg = err?.message || 'Failed to load staff list';
        setStaffError(errMsg);
        setIsStaffLoading(false);
        showToast(`Failed to load staff accounts: ${errMsg}`, 'error');
      }
    );
    return () => unsubStaff();
  }, []);

  // Subscribe to real-time appointments across all customers
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    setHasLoadedOnce(false);

    const unsubscribe = subscribeToAllAppointments(
      (list) => {
        setAppointments(list);
        setIsLoading(false);
        setLoadError(null); // clear any prior error on successful snapshot
        setHasLoadedOnce(true);
      },
      (err) => {
        console.error('Admin appointments subscription failed:', err);
        const isPermission = err?.code === 'permission-denied' || /permission/i.test(err?.message || '');
        setLoadError(
          isPermission
            ? 'Permission denied — the Firestore security rules do not grant this account admin access to the appointments collection group yet. Deploy the updated firestore.rules file to Firebase to fix this.'
            : (err?.message || 'Failed to load customer appointments.')
        );
        setIsLoading(false);
        // don't wipe the appointments list if we had data before the error
      }
    );

    return () => unsubscribe();
  }, [refreshKey]);

  // Filtered and sorted appointments
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((appt) => {
        const dyn = getDynamicAppointmentStatus(
          appt.date,
          appt.time,
          appt.status === 'Missed',
          appt.completed,
          false,
          appt.status,
          appt.confirmed,
          appt.staffStatus
        );

        // Tab filter
        if (filterTab === 'awaiting') {
          return dyn.status === 'Awaiting Confirmation' || appt.confirmed === false;
        }
        if (filterTab === 'confirmed') {
          return dyn.status === 'Confirmed' && appt.status !== 'Cancelled' && !appt.completed;
        }
        if (filterTab === 'cancelled') {
          return dyn.status === 'Cancelled' || appt.status === 'Cancelled';
        }
        if (filterTab === 'completed') {
          return dyn.status === 'Completed' || appt.completed === true;
        }
        return true; // 'all'
      })
      .filter((appt) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        const refId = appt.id.toLowerCase();
        const cName = (appt.customerName || '').toLowerCase();
        const cEmail = (appt.customerEmail || '').toLowerCase();
        const cPhone = (appt.customerPhone || '').toLowerCase();
        const pkg = (appt.packageName || '').toLowerCase();
        const veh = (appt.vehicle || '').toLowerCase();
        const loc = (appt.address || appt.location || '').toLowerCase();

        return (
          refId.includes(query) ||
          cName.includes(query) ||
          cEmail.includes(query) ||
          cPhone.includes(query) ||
          pkg.includes(query) ||
          veh.includes(query) ||
          loc.includes(query)
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') {
          return (b.createdAt || 0) - (a.createdAt || 0);
        }
        // Date sort fallback to createdAt
        return sortOrder === 'date_asc'
          ? (a.createdAt || 0) - (b.createdAt || 0)
          : (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [appointments, filterTab, searchQuery, sortOrder]);

  // Statistics counters
  const stats = useMemo(() => {
    let awaiting = 0;
    let confirmed = 0;
    let cancelled = 0;
    let completed = 0;

    appointments.forEach((appt) => {
      const dyn = getDynamicAppointmentStatus(
        appt.date,
        appt.time,
        appt.status === 'Missed',
        appt.completed,
        false,
        appt.status,
        appt.confirmed,
        appt.staffStatus
      );

      if (dyn.status === 'Awaiting Confirmation' || appt.confirmed === false) awaiting++;
      else if (dyn.status === 'Cancelled' || appt.status === 'Cancelled') cancelled++;
      else if (dyn.status === 'Completed' || appt.completed === true) completed++;
      else confirmed++;
    });

    return {
      total: appointments.length,
      awaiting,
      confirmed,
      cancelled,
      completed,
    };
  }, [appointments]);

  // Handle owner staff assignment & confirmation action
  const handleConfirm = async (appt: StoredAppointment & { customerUid: string }) => {
    if (!currentUser || !currentUser.uid) {
      showToast('You must be signed in as an administrator to confirm appointments.', 'error');
      return;
    }

    if (!appt.customerUid?.trim() || !appt.id?.trim()) {
      showToast('Missing customer or appointment identifier.', 'error');
      return;
    }

    if (appt.status === 'Cancelled') {
      showToast('Cannot confirm a cancelled appointment.', 'error');
      return;
    }

    if (appt.completed) {
      showToast('Cannot confirm an already completed appointment.', 'error');
      return;
    }

    const selectedStaffUid = selectedStaffMap[appt.id];
    if (!selectedStaffUid) {
      showToast('Please select a staff member to assign to this booking before confirming.', 'error');
      return;
    }

    const selectedStaff = staffList.find((s) => s.uid === selectedStaffUid && s.isActivated);
    if (!selectedStaff || !selectedStaff.uid || !selectedStaff.name?.trim()) {
      showToast('Selected staff member is invalid or not yet activated. Please select an active staff member.', 'error');
      return;
    }

    if (confirmingId === appt.id) return; // Prevent duplicate submissions
    setConfirmingId(appt.id);

    try {
      await confirmAppointmentByOwner(
        appt.customerUid,
        appt.id,
        {
          uid: selectedStaff.uid,
          name: selectedStaff.name,
        },
        {
          uid: currentUser.uid,
          name: currentUser.displayName || 'Owner',
        }
      );
      showToast('Appointment confirmed successfully', 'success');
    } catch (err: any) {
      console.error('Failed to confirm appointment:', err);
      showToast(err?.message || 'Failed to confirm appointment. Please try again.', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  const getStatusBadge = (appt: StoredAppointment) => {
    const dyn = getDynamicAppointmentStatus(
      appt.date,
      appt.time,
      appt.status === 'Missed',
      appt.completed,
      false,
      appt.status,
      appt.confirmed,
      appt.staffStatus
    );

    if (dyn.status === 'Cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          <XCircle className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    }

    if (dyn.status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    }

    if (dyn.status === 'Awaiting Confirmation') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
          <Clock className="w-3.5 h-3.5" />
          Awaiting Confirmation
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Confirmed
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards text-[#F5F5F5] font-sans pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#F5F5F5]">
            Customer Appointments
          </h1>
          <p className="text-[#A1A1AA] text-sm mt-1">
            Review and manage all incoming bookings, approve requests, reschedule, and handle cancellations in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRefreshKey((prev) => prev + 1);
            }}
            className="p-2.5 rounded-xl bg-[#171717] border border-[#2C2C2C] text-[#A1A1AA] hover:text-[#F5F5F5] hover:border-[#E86A33]/50 transition-colors flex items-center gap-2 text-xs font-medium cursor-pointer"
            title="Refresh Live Appointments"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#E86A33]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Summary Metrics Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <button
          onClick={() => setFilterTab('all')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-[#E86A33]/10 border-[#E86A33] shadow-md shadow-[#E86A33]/10'
              : 'bg-[#171717] border-[#2C2C2C] hover:border-[#3C3C3C]'
          }`}
        >
          <span className="text-xs text-[#A1A1AA] font-medium block">All Appointments</span>
          <span className="text-2xl font-bold font-display text-[#F5F5F5] mt-1 block">
            {stats.total}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('awaiting')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filterTab === 'awaiting'
              ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
              : 'bg-[#171717] border-[#2C2C2C] hover:border-[#3C3C3C]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400 font-medium block">Awaiting Confirmation</span>
            {stats.awaiting > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <span className="text-2xl font-bold font-display text-amber-400 mt-1 block">
            {stats.awaiting}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('confirmed')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filterTab === 'confirmed'
              ? 'bg-[#E86A33]/10 border-[#E86A33] shadow-md shadow-[#E86A33]/10'
              : 'bg-[#171717] border-[#2C2C2C] hover:border-[#3C3C3C]'
          }`}
        >
          <span className="text-xs text-[#E86A33] font-medium block">Confirmed</span>
          <span className="text-2xl font-bold font-display text-[#E86A33] mt-1 block">
            {stats.confirmed}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('cancelled')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filterTab === 'cancelled'
              ? 'bg-red-500/10 border-red-500 shadow-md shadow-red-500/10'
              : 'bg-[#171717] border-[#2C2C2C] hover:border-[#3C3C3C]'
          }`}
        >
          <span className="text-xs text-red-400 font-medium block">Cancelled</span>
          <span className="text-2xl font-bold font-display text-red-400 mt-1 block">
            {stats.cancelled}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('completed')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer col-span-2 lg:col-span-1 ${
            filterTab === 'completed'
              ? 'bg-[#35B86B]/10 border-[#35B86B] shadow-md shadow-[#35B86B]/10'
              : 'bg-[#171717] border-[#2C2C2C] hover:border-[#3C3C3C]'
          }`}
        >
          <span className="text-xs text-[#35B86B] font-medium block">Completed</span>
          <span className="text-2xl font-bold font-display text-[#35B86B] mt-1 block">
            {stats.completed}
          </span>
        </button>
      </div>

      {/* ── Search and Filter Controls ── */}
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer, ref ID, phone, vehicle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101010] border border-[#2C2C2C] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F5F5F5] placeholder:text-[#71717A] focus:outline-none focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#71717A] hover:text-[#F5F5F5]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filterTab === 'all'
                ? 'bg-[#E86A33] text-white'
                : 'bg-[#101010] text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilterTab('awaiting')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filterTab === 'awaiting'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#101010] text-amber-400/90 hover:bg-amber-500/10'
            }`}
          >
            Awaiting ({stats.awaiting})
          </button>
          <button
            onClick={() => setFilterTab('confirmed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filterTab === 'confirmed'
                ? 'bg-[#E86A33] text-white'
                : 'bg-[#101010] text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            Confirmed ({stats.confirmed})
          </button>
          <button
            onClick={() => setFilterTab('cancelled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filterTab === 'cancelled'
                ? 'bg-red-500 text-white'
                : 'bg-[#101010] text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            Cancelled ({stats.cancelled})
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filterTab === 'completed'
                ? 'bg-[#35B86B] text-white'
                : 'bg-[#101010] text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
            }`}
          >
            Completed ({stats.completed})
          </button>
        </div>
      </div>

      {/* ── Error Banner — only shown when not loading ── */}
      {!isLoading && loadError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-400">Failed to load appointments</h4>
            <p className="text-xs text-red-300/80 mt-1 leading-relaxed">{loadError}</p>
          </div>
          <button
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="text-xs text-red-400 underline font-medium hover:text-red-300 shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-[#E86A33] animate-spin mb-3" />
          <p className="text-base font-semibold text-[#F5F5F5]">Loading appointments...</p>
          <p className="text-xs text-[#71717A] mt-1">Connecting to Firestore real-time collection...</p>
        </div>
      )}

      {/* ── Empty State — only shown after a successful load with no results ── */}
      {!isLoading && !loadError && hasLoadedOnce && filteredAppointments.length === 0 && (
        <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#101010] border border-[#2C2C2C] flex items-center justify-center mb-3">
            <CalendarDays className="w-6 h-6 text-[#71717A]" />
          </div>
          <h3 className="text-lg font-semibold text-[#F5F5F5]">No appointments found</h3>
          <p className="text-sm text-[#A1A1AA] max-w-sm mt-1">
            {searchQuery
              ? `No bookings match your search query "${searchQuery}". Try adjusting your filters.`
              : filterTab === 'awaiting'
              ? 'No appointments currently awaiting confirmation.'
              : 'There are no appointments to display in this category.'}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              onClick={() => setSearchQuery('')}
              className="mt-4 !py-2 !px-4 !text-xs !border-[#2C2C2C] !text-[#F5F5F5]"
            >
              Reset Search
            </Button>
          )}
        </div>
      )}

      {/* ── Appointments List — only shown when no blocking error ── */}
      {!isLoading && !loadError && filteredAppointments.length > 0 && (
        <div className="flex flex-col gap-4">
          {filteredAppointments.map((appt) => {
            const isAwaiting = appt.confirmed === false || appt.status === 'Awaiting Confirmation';
            const isCancelled = appt.status === 'Cancelled';
            const isCompleted = appt.completed === true || appt.status === 'Completed';
            const isSaving = confirmingId === appt.id;

            return (
              <div
                key={appt.id}
                className={`bg-[#171717] border rounded-2xl p-5 md:p-6 transition-all duration-200 shadow-sm flex flex-col gap-5 ${
                  isAwaiting
                    ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/[0.03] to-transparent hover:border-amber-500/60'
                    : 'border-[#2C2C2C] hover:border-[#E86A33]/40'
                }`}
              >
                {/* Row 1: Status, Reference ID, Rescheduled Badge, and Price */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2C2C2C] pb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {getStatusBadge(appt)}

                    <span className="font-mono text-xs font-bold text-[#A1A1AA] bg-[#101010] px-2.5 py-1 rounded-lg border border-[#2C2C2C]">
                      #{appt.id}
                    </span>

                    {appt.serviceType && (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-[#101010] text-[#D4D4D4] border border-[#2C2C2C] font-medium">
                        {appt.serviceType}
                      </span>
                    )}

                    {appt.rescheduledByOwner && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E86A33]/15 text-[#E86A33] border border-[#E86A33]/30">
                        <Sparkles className="w-3 h-3" />
                        Rescheduled by owner
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#71717A]">Total</span>
                    <span className="text-lg font-bold font-display text-[#F5F5F5]">
                      {appt.price}
                    </span>
                  </div>
                </div>

                {/* Row 2: Customer Info + Service & Vehicle + Schedule */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Customer Information Column */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                      Customer
                    </span>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#101010] border border-[#2C2C2C] flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-[#E86A33]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-[#F5F5F5] truncate">
                          {appt.customerName || 'Customer'}
                        </span>
                        {appt.customerEmail && (
                          <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] mt-0.5 truncate">
                            <Mail className="w-3 h-3 shrink-0 text-[#71717A]" />
                            <span className="truncate">{appt.customerEmail}</span>
                          </div>
                        )}
                        {appt.customerPhone && (
                          <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] mt-0.5">
                            <Phone className="w-3 h-3 shrink-0 text-[#71717A]" />
                            <span>{appt.customerPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Vehicle & Package Column */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                      Service & Vehicle
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-[#E86A33] shrink-0" />
                        <span className="text-sm font-medium text-[#F5F5F5] truncate">
                          {appt.vehicle || 'Standard Vehicle'}
                        </span>
                      </div>
                      <span className="text-xs text-[#A1A1AA] pl-6 font-medium">
                        Package: {appt.packageName}
                      </span>
                      {appt.serviceType === 'Call-out' && (appt.address || appt.location) && (
                        <div className="flex items-start gap-1.5 text-xs text-[#71717A] pl-6 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-[#E86A33] mt-0.5" />
                          <span className="truncate">{appt.address || appt.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule Column */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold">
                      Scheduled Date & Time
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-[#F5F5F5]">
                        <Calendar className="w-4 h-4 text-[#E86A33]" />
                        <span>{appt.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#A1A1AA] pl-6">
                        <Clock className="w-3.5 h-3.5 text-[#E86A33]" />
                        <span>{appt.time}</span>
                      </div>
                      {appt.previousSchedule && (
                        <div className="text-[11px] text-[#71717A] pl-6 line-through mt-0.5">
                          Was: {appt.previousSchedule.date} at {appt.previousSchedule.time}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Optional Notes or Cancel Reason Banner */}
                {appt.cancelReason && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-red-400">Cancellation Reason: </span>
                      {appt.cancelReason}
                      {appt.cancelledByName && (
                        <span className="text-red-400/80 ml-2">
                          (by {appt.cancelledByName})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {appt.notes && !appt.cancelReason && (
                  <div className="p-3 rounded-xl bg-[#101010] border border-[#2C2C2C] text-xs text-[#A1A1AA]">
                    <span className="text-[#71717A] font-medium mr-1.5">Customer Notes:</span>
                    {appt.notes}
                  </div>
                )}

                {/* Row 3: Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2C2C2C]">
                  <div className="text-xs text-[#71717A] flex items-center gap-2 flex-wrap">
                    {appt.confirmed && appt.staffName && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#35B86B] font-medium bg-[#35B86B]/10 px-2.5 py-1 rounded-lg border border-[#35B86B]/20">
                        <UserCheck className="w-3.5 h-3.5 text-[#35B86B]" />
                        Assigned to: <strong className="text-[#F5F5F5]">{appt.staffName}</strong>
                      </span>
                    )}
                    {appt.confirmedByName && appt.confirmed && (
                      <span className="text-[#71717A]">
                        (Confirmed by {appt.confirmedByName})
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-[#35B86B]">Wash service completed</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 ml-auto">
                    {/* Staff Selector and Assign & Confirm Action for Awaiting Confirmation */}
                    {isAwaiting && !isCancelled && !isCompleted && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <select
                            id={`staff-select-${appt.id}`}
                            value={selectedStaffMap[appt.id] || ''}
                            onChange={(e) =>
                              setSelectedStaffMap((prev) => ({
                                ...prev,
                                [appt.id]: e.target.value,
                              }))
                            }
                            disabled={isSaving || isStaffLoading || staffList.length === 0}
                            aria-label="Assign staff member"
                            className="bg-[#101010] border border-[#2C2C2C] text-[#F5F5F5] text-xs rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] transition-all cursor-pointer disabled:opacity-50 appearance-none font-medium max-w-[210px] truncate"
                          >
                            <option value="">
                              {isStaffLoading
                                ? 'Loading staff members...'
                                : staffError
                                ? `Error: ${staffError}`
                                : staffList.length === 0
                                ? 'No registered staff found'
                                : 'Select staff member... *'}
                            </option>
                            {staffList.map((staff) => (
                              <option
                                key={staff.preRegDocId || staff.employeeId || staff.email || staff.uid}
                                value={staff.isActivated ? staff.uid : ''}
                                disabled={!staff.isActivated}
                                className={staff.isActivated ? "bg-[#171717] text-[#F5F5F5]" : "bg-[#171717] text-[#71717A] italic"}
                              >
                                {staff.isActivated ? staff.name : `${staff.name} (Pending Activation)`}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#71717A]">
                            <UserPlus className="w-3.5 h-3.5 text-[#E86A33]" />
                          </div>
                        </div>

                        <Button
                          variant="primary"
                          isLoading={isSaving}
                          disabled={!selectedStaffMap[appt.id] || isSaving || isStaffLoading}
                          onClick={() => handleConfirm(appt)}
                          className="!py-2 !px-3.5 !text-xs gap-1.5 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            !selectedStaffMap[appt.id]
                              ? 'Select a staff member before confirming'
                              : 'Assign staff member and confirm booking'
                          }
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Assign & Confirm
                        </Button>
                      </div>
                    )}

                    {/* Reschedule Action (Available for awaiting or confirmed, protected for terminal) */}
                    {!isCancelled && !isCompleted && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/dashboard/admin/appointments/reschedule/${appt.customerUid}/${appt.id}`,
                            { state: { appointment: appt } }
                          )
                        }
                        className="!py-2 !px-3.5 !text-xs gap-1.5 !border-[#2C2C2C] !text-[#F5F5F5] hover:!border-[#E86A33] hover:!text-[#E86A33]"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#E86A33]" />
                        Reschedule
                      </Button>
                    )}

                    {/* Cancel Action (Available for awaiting or confirmed, protected for terminal) */}
                    {!isCancelled && !isCompleted && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/dashboard/admin/appointments/cancel/${appt.customerUid}/${appt.id}`,
                            { state: { appointment: appt } }
                          )
                        }
                        className="!py-2 !px-3.5 !text-xs gap-1.5 !border-[#2C2C2C] !text-[#EF4444] hover:!bg-red-500/10 hover:!border-red-500/50"
                      >
                        <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                        Cancel
                      </Button>
                    )}

                    {/* View Details / Protected Notice for terminal records */}
                    {(isCancelled || isCompleted) && (
                      <span className="text-xs text-[#71717A] italic py-1.5">
                        Protected appointment history
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

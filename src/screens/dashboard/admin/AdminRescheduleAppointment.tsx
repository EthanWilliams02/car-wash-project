import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  adminRescheduleAppointment,
  parseAppointmentDateTime,
  type StoredAppointment,
} from '../../../lib/appointments';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

const RESCHEDULE_REASON_PRESETS = [
  'Owner schedule adjustment / optimal bay slot',
  'Severe weather / rain forecasted on original date',
  'Customer requested reschedule via phone',
  'Equipment maintenance on previous date',
  'Staff capacity optimization',
];

export default function AdminRescheduleAppointment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { customerUid, appointmentId } = useParams<{ customerUid: string; appointmentId: string }>();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [appointment, setAppointment] = useState<StoredAppointment | null>(
    (location.state?.appointment as StoredAppointment) || null
  );
  const [customerProfile, setCustomerProfile] = useState<{
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  } | null>(null);

  // Form states
  const todayDateStr = new Date().toISOString().split('T')[0];
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('10:00');
  const [reason, setReason] = useState('');

  const [isLoading, setIsLoading] = useState(!appointment);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to real-time appointment doc from Firestore so refreshes always work
  useEffect(() => {
    if (!customerUid || !appointmentId) {
      navigate('/dashboard/admin/appointments', { replace: true });
      return;
    }

    const apptRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
    const unsub = onSnapshot(
      apptRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as StoredAppointment;
          setAppointment(data);
          setIsLoading(false);
        } else {
          setErrorMessage('Appointment not found.');
          setIsLoading(false);
        }
      },
      (err) => {
        console.error('Failed to listen to appointment doc:', err);
        setErrorMessage('Failed to load appointment details.');
        setIsLoading(false);
      }
    );

    // Also fetch customer profile info if missing
    getDoc(doc(db, 'users', customerUid))
      .then((userSnap) => {
        if (userSnap.exists()) {
          const u = userSnap.data();
          setCustomerProfile({
            fullName: u.fullName || u.displayName,
            email: u.email,
            phoneNumber: u.phoneNumber,
          });
        }
      })
      .catch(() => {});

    return () => unsub();
  }, [customerUid, appointmentId, navigate]);

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!newDate) {
      setValidationError('Please select a new date for the appointment.');
      return;
    }
    if (!newTime) {
      setValidationError('Please select a new time for the appointment.');
      return;
    }
    if (!reason.trim()) {
      setValidationError('Please provide a reason for rescheduling.');
      return;
    }

    // Reject past dates and times
    const targetDate = parseAppointmentDateTime(newDate, newTime);
    if (!targetDate || targetDate.getTime() < Date.now()) {
      setValidationError('The rescheduled date and time cannot be in the past.');
      return;
    }

    if (!customerUid || !appointmentId || !currentUser) {
      showToast('Missing required parameters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminRescheduleAppointment(
        customerUid,
        appointmentId,
        newDate,
        newTime,
        reason.trim(),
        {
          uid: currentUser.uid,
          name: currentUser.displayName || 'Owner',
        }
      );

      showToast(`Appointment #${appointmentId} rescheduled to ${newDate} at ${newTime}. Customer was notified.`, 'success');
      navigate('/dashboard/admin/appointments');
    } catch (err: any) {
      console.error('Admin rescheduling failed:', err);
      showToast(err?.message || 'Failed to reschedule appointment. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-12 text-center text-[#A1A1AA]">
        Loading appointment details...
      </div>
    );
  }

  if (errorMessage || !appointment) {
    return (
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-8 text-center flex flex-col items-center gap-4">
        <p className="text-red-400 font-medium">{errorMessage || 'Appointment not found'}</p>
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard/admin/appointments')}
          className="!border-[#2C2C2C] !text-[#F5F5F5]"
        >
          Back to Appointments
        </Button>
      </div>
    );
  }

  const isAlreadyCancelled = appointment.status === 'Cancelled';
  const isAlreadyCompleted = appointment.completed === true || appointment.status === 'Completed';

  const customerName = appointment.customerName || customerProfile?.fullName || 'Customer';
  const customerEmail = appointment.customerEmail || customerProfile?.email;
  const customerPhone = appointment.customerPhone || customerProfile?.phoneNumber;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards text-[#F5F5F5] font-sans pb-12 max-w-3xl mx-auto">
      {/* Top Header / Back Button */}
      <div className="flex flex-col gap-1">
        <button
          onClick={() => navigate('/dashboard/admin/appointments')}
          className="flex items-center gap-1.5 text-sm text-[#E86A33] hover:text-[#d45b27] transition-colors w-fit mb-2 cursor-pointer font-medium"
        >
          <ArrowLeft className="w-4 h-4 text-[#E86A33]" />
          Back to Appointments
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#F5F5F5]">
          Reschedule Appointment
        </h1>
        <p className="text-[#A1A1AA] text-sm">
          Select a new schedule slot, record the reason, and update the booking. Owner-approved reschedules are marked Confirmed.
        </p>
      </div>

      {/* Terminal State Alert */}
      {isAlreadyCancelled && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-400">Appointment is cancelled</h4>
            <p className="text-xs text-red-300/80 mt-1">
              Cancelled appointments cannot be rescheduled.
            </p>
          </div>
        </div>
      )}

      {isAlreadyCompleted && (
        <div className="p-4 rounded-xl bg-[#35B86B]/10 border border-[#35B86B]/30 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#35B86B] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-[#35B86B]">Appointment is completed</h4>
            <p className="text-xs text-[#35B86B]/80 mt-1">
              Completed bookings cannot be rescheduled.
            </p>
          </div>
        </div>
      )}

      {/* Main Rescheduling Form */}
      <form onSubmit={handleConfirmReschedule} className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
        {/* Header row with Reference ID */}
        <div className="flex items-center justify-between border-b border-[#2C2C2C] pb-4">
          <div>
            <span className="text-xs text-[#71717A] uppercase tracking-wider font-semibold">
              Appointment Reference
            </span>
            <h3 className="text-lg font-bold font-mono text-[#F5F5F5] mt-0.5">
              #{appointment.id}
            </h3>
          </div>
          <span className="text-sm font-bold text-[#E86A33] bg-[#E86A33]/10 px-3 py-1 rounded-lg border border-[#E86A33]/20">
            {appointment.price}
          </span>
        </div>

        {/* Customer Information Card */}
        <div className="bg-[#101010] border border-[#2C2C2C] rounded-xl p-4 flex flex-col gap-3">
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
            Customer Information
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1F1F1F] border border-[#2C2C2C] flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-[#E86A33]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#F5F5F5]">{customerName}</span>
                {customerEmail && (
                  <span className="text-xs text-[#A1A1AA] flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-[#71717A]" />
                    {customerEmail}
                  </span>
                )}
              </div>
            </div>

            {customerPhone && (
              <div className="flex items-center gap-2 text-xs text-[#A1A1AA] bg-[#171717] px-3 py-1.5 rounded-lg border border-[#2C2C2C]">
                <Phone className="w-3.5 h-3.5 text-[#E86A33]" />
                <span className="font-mono">{customerPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Current Schedule vs New Schedule Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Schedule Box */}
          <div className="p-4 rounded-xl bg-[#101010] border border-[#2C2C2C] flex flex-col gap-2">
            <span className="text-xs text-[#71717A] font-semibold uppercase tracking-wider">
              Current Schedule
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F5] mt-1">
              <Calendar className="w-4 h-4 text-[#A1A1AA]" />
              <span>{appointment.date}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
              <Clock className="w-3.5 h-3.5 text-[#A1A1AA]" />
              <span>{appointment.time}</span>
            </div>
            <span className="text-[11px] text-[#71717A] mt-1">
              Package: {appointment.packageName} • {appointment.vehicle}
            </span>
          </div>

          {/* New Schedule Box */}
          <div className="p-4 rounded-xl bg-[#E86A33]/5 border border-[#E86A33]/30 flex flex-col gap-2">
            <span className="text-xs text-[#E86A33] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              New Proposed Schedule
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F5] mt-1">
              <Calendar className="w-4 h-4 text-[#E86A33]" />
              <span>{newDate || 'Choose new date below'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#E86A33]">
              <Clock className="w-3.5 h-3.5 text-[#E86A33]" />
              <span>{newTime || 'Choose time'}</span>
            </div>
            <span className="text-[11px] text-[#A1A1AA] mt-1">
              {appointment?.confirmed && appointment?.assignedStaffUid
                ? 'Will remain Confirmed with owner reschedule tag'
                : 'Will remain Awaiting Confirmation until staff member is assigned'}
            </span>
          </div>
        </div>

        {/* Date and Time Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="New Date *"
            value={newDate}
            min={todayDateStr}
            onChange={(e) => {
              setNewDate(e.target.value);
              setValidationError(null);
            }}
            icon={<Calendar className="w-4 h-4" />}
            required
            className="[color-scheme:dark]"
          />

          <Input
            type="time"
            label="New Time *"
            value={newTime}
            onChange={(e) => {
              setNewTime(e.target.value);
              setValidationError(null);
            }}
            icon={<Clock className="w-4 h-4" />}
            required
            className="[color-scheme:dark]"
          />
        </div>

        {/* Rescheduling Reason */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[#F5F5F5]">
            Reason for Rescheduling <span className="text-[#E86A33]">*</span>
          </label>
          <p className="text-xs text-[#71717A]">
            Explain why the schedule was adjusted. The customer will receive this explanation in their notification and see it on their appointment card.
          </p>

          {/* Preset Chips */}
          <div className="flex flex-wrap gap-2 my-2">
            {RESCHEDULE_REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all text-left cursor-pointer ${
                  reason === preset
                    ? 'bg-[#E86A33]/15 border-[#E86A33] text-[#E86A33] font-medium'
                    : 'bg-[#101010] border-[#2C2C2C] text-[#A1A1AA] hover:border-[#3C3C3C] hover:text-[#F5F5F5]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setValidationError(null);
            }}
            disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
            placeholder="Please enter or select a reason for rescheduling..."
            className="w-full bg-[#101010] border border-[#2C2C2C] rounded-xl p-4 text-sm text-[#F5F5F5] placeholder:text-[#71717A] focus:outline-none focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] min-h-[100px] resize-y transition-all disabled:opacity-50"
            required
          />
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium">
            {validationError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#2C2C2C]">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/dashboard/admin/appointments')}
            disabled={isSubmitting}
            className="!border-[#2C2C2C] !text-[#F5F5F5] hover:!border-[#E86A33]"
          >
            Go Back
          </Button>

          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={
              !newDate ||
              !newTime ||
              !reason.trim() ||
              isAlreadyCancelled ||
              isAlreadyCompleted ||
              isSubmitting
            }
            className="gap-2 font-semibold shadow-md shadow-[#E86A33]/10"
          >
            <CheckCircle2 className="w-4 h-4" />
            {appointment?.confirmed && appointment?.assignedStaffUid
              ? 'Save & Confirm New Schedule'
              : 'Save Rescheduled Time'}
          </Button>
        </div>
      </form>
    </div>
  );
}

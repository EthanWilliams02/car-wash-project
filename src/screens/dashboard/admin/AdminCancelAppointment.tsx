import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  Clock,
  Car,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  adminCancelAppointment,
  type StoredAppointment,
} from '../../../lib/appointments';
import { Button } from '../../../components/ui/Button';

const REASON_PRESETS = [
  'Customer requested cancellation by phone/email',
  'Severe weather / rain expected',
  'Equipment maintenance & servicing',
  'Fully booked / scheduling conflict at this slot',
  'Vehicle location outside service radius',
];

export default function AdminCancelAppointment() {
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

  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(!appointment);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleConfirmCancel = async () => {
    if (!reason.trim()) {
      showToast('Please provide a reason for the cancellation.', 'error');
      return;
    }
    if (!customerUid || !appointmentId || !currentUser) {
      showToast('Missing required parameters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminCancelAppointment(customerUid, appointmentId, reason.trim(), {
        uid: currentUser.uid,
        name: currentUser.displayName || 'Owner',
      });

      showToast(`Appointment #${appointmentId} cancelled. Customer was notified with the reason.`, 'info');
      navigate('/dashboard/admin/appointments');
    } catch (err: any) {
      console.error('Admin cancellation failed:', err);
      showToast(err?.message || 'Failed to cancel appointment. Please try again.', 'error');
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
          Cancel Appointment
        </h1>
        <p className="text-[#A1A1AA] text-sm">
          Review appointment details, specify a cancellation reason, and inform the customer.
        </p>
      </div>

      {/* Terminal State Alert */}
      {isAlreadyCancelled && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-400">Appointment is already cancelled</h4>
            <p className="text-xs text-red-300/80 mt-1">
              Reason: "{appointment.cancelReason || 'No reason specified'}"
            </p>
          </div>
        </div>
      )}

      {isAlreadyCompleted && (
        <div className="p-4 rounded-xl bg-[#35B86B]/10 border border-[#35B86B]/30 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#35B86B] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-[#35B86B]">Appointment is already completed</h4>
            <p className="text-xs text-[#35B86B]/80 mt-1">
              Completed bookings cannot be cancelled.
            </p>
          </div>
        </div>
      )}

      {/* Main Cancellation Card */}
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
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

        {/* Appointment Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-[#101010] border border-[#2C2C2C]">
            <span className="text-[#71717A] font-medium">Service Package</span>
            <span className="text-sm font-semibold text-[#F5F5F5]">{appointment.packageName}</span>
          </div>

          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-[#101010] border border-[#2C2C2C]">
            <span className="text-[#71717A] font-medium">Vehicle</span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#F5F5F5]">
              <Car className="w-4 h-4 text-[#E86A33]" />
              <span>{appointment.vehicle}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-[#101010] border border-[#2C2C2C]">
            <span className="text-[#71717A] font-medium">Scheduled Date & Time</span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#F5F5F5]">
              <Calendar className="w-4 h-4 text-[#E86A33]" />
              <span>{appointment.date}</span>
              <span className="text-[#71717A]">•</span>
              <Clock className="w-4 h-4 text-[#E86A33]" />
              <span>{appointment.time}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-[#101010] border border-[#2C2C2C]">
            <span className="text-[#71717A] font-medium">Location / Service Type</span>
            <div className="flex items-center gap-1.5 text-sm font-medium text-[#F5F5F5]">
              <MapPin className="w-4 h-4 text-[#E86A33] shrink-0" />
              <span className="truncate">
                {appointment.serviceType === 'Drive-in'
                  ? 'Drive-in (Wash Bay)'
                  : appointment.address || appointment.location || 'Call-out Address'}
              </span>
            </div>
          </div>
        </div>

        {/* Cancellation Reason Input */}
        <div className="flex flex-col gap-2 mt-1">
          <label className="text-sm font-medium text-[#F5F5F5]">
            Reason for Cancellation <span className="text-red-400">*</span>
          </label>
          <p className="text-xs text-[#71717A]">
            This reason will be recorded in the appointment history and sent to the customer in an in-app notification.
          </p>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 my-2">
            {REASON_PRESETS.map((preset) => (
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
            onChange={(e) => setReason(e.target.value)}
            disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
            placeholder="Please enter or select a specific cancellation reason..."
            className="w-full bg-[#101010] border border-[#2C2C2C] rounded-xl p-4 text-sm text-[#F5F5F5] placeholder:text-[#71717A] focus:outline-none focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] min-h-[110px] resize-y transition-all disabled:opacity-50"
            required
          />
        </div>

        {/* Refund Transparency Note */}
        <div className="p-4 rounded-xl bg-[#101010] border border-[#2C2C2C] flex items-start gap-3 text-xs text-[#A1A1AA]">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="text-[#F5F5F5] font-semibold">Important Note: </span>
            Cancelling this appointment updates customer records and sends an in-app notification. If a monetary refund is warranted under your store policy, process it through your payment provider dashboard. No automated financial debit/credit is performed.
          </p>
        </div>

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
            type="button"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!reason.trim() || isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
            onClick={handleConfirmCancel}
            className="!bg-red-600 hover:!bg-red-700 !text-white border-none gap-2 font-semibold shadow-md shadow-red-900/20"
          >
            <XCircle className="w-4 h-4" />
            Confirm Cancellation
          </Button>
        </div>
      </div>
    </div>
  );
}

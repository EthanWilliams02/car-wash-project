import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useNotifications } from '../../../contexts/NotificationsContext';
import { cancelAppointment, type StoredAppointment } from '../../../lib/appointments';
import { db } from '../../../lib/firebase';
import { Button } from '../../../components/ui/Button';
import { ArrowLeft, User, AlertCircle, XCircle } from 'lucide-react';

export default function CustomerCancel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appointmentId: routeApptId } = useParams<{ appointmentId?: string }>();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { addNotification } = useNotifications();

  const stateAppt = location.state?.appointment as StoredAppointment | undefined;
  const targetApptId = routeApptId || stateAppt?.id;
  const [appointment, setAppointment] = useState<StoredAppointment | null>(stateAppt || null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!stateAppt);

  // Subscribe to real-time appointment doc from Firestore to prevent stale navigation state overwrites
  useEffect(() => {
    if (!targetApptId) {
      navigate('/dashboard/customer/appointments', { replace: true });
      return;
    }

    if (currentUser?.uid && targetApptId) {
      const apptRef = doc(db, 'users', currentUser.uid, 'appointments', targetApptId);
      const unsub = onSnapshot(
        apptRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setAppointment({ id: docSnap.id, ...docSnap.data() } as StoredAppointment);
          }
          setIsLoading(false);
        },
        (err) => {
          console.warn('Failed to listen to live appointment in CustomerCancel:', err);
          setIsLoading(false);
        }
      );
      return () => unsub();
    } else {
      setIsLoading(false);
    }
  }, [currentUser?.uid, targetApptId, navigate]);

  if (isLoading || !appointment) {
    return (
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-8 text-center text-[#A1A1AA]">
        Loading appointment details...
      </div>
    );
  }

  const isAlreadyCancelled = appointment.status === 'Cancelled';
  const isAlreadyCompleted = appointment.completed === true || appointment.status === 'Completed';

  const handleConfirmCancellation = async () => {
    if (!reason.trim()) {
      showToast('Please provide a reason for cancellation', 'error');
      return;
    }
    if (isAlreadyCancelled) {
      showToast('This appointment is already cancelled.', 'error');
      return;
    }
    if (isAlreadyCompleted) {
      showToast('Completed appointments cannot be cancelled.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await cancelAppointment(appointment.id, reason.trim(), currentUser?.uid, {
        uid: currentUser?.uid || '',
        name: currentUser?.displayName || 'Customer',
        role: 'customer',
      });
      
      addNotification({
        category: 'appointments',
        icon: 'calendar',
        title: 'Appointment Cancelled',
        message: `Your appointment for ${appointment.packageName} on ${appointment.date} has been cancelled.`,
        link: '/dashboard/customer/appointments',
        eventId: `appt-cancel-${appointment.id}-${Date.now()}`,
      });

      showToast('Appointment has been successfully cancelled', 'info');
      navigate('/dashboard/customer/appointments');
    } catch (err: any) {
      console.error('Customer cancellation failed:', err);
      showToast(err?.message || 'Failed to cancel appointment. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards text-[#F5F5F5]">
      {/* TopHeader/Title area */}
      <div className="flex flex-col gap-1">
        <button 
          onClick={() => navigate('/dashboard/customer/appointments')}
          className="flex items-center gap-1.5 text-sm text-[#E86A33] hover:text-[#cc5a2a] transition-colors w-fit mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#E86A33]" />
          Back to Appointments
        </button>
        <h2 className="text-2xl font-bold font-display tracking-tight text-[#F5F5F5]">Cancellation</h2>
        <p className="text-[#A1A1AA] text-sm">Cancel your booking</p>
      </div>

      {/* Terminal Warning if already modified by admin */}
      {isAlreadyCancelled && (
        <div className="max-w-2xl w-full mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-400">This appointment has already been cancelled</h4>
            <p className="text-xs text-red-300/80 mt-1">
              Reason: "{appointment.cancelReason || 'Cancelled by administrator'}"
            </p>
          </div>
        </div>
      )}

      {isAlreadyCompleted && (
        <div className="max-w-2xl w-full mx-auto p-4 rounded-xl bg-[#35B86B]/10 border border-[#35B86B]/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#35B86B] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-[#35B86B]">This appointment is already completed</h4>
            <p className="text-xs text-[#35B86B]/80 mt-1">
              Completed bookings cannot be cancelled.
            </p>
          </div>
        </div>
      )}

      {/* Centered Card */}
      <div className="max-w-2xl w-full mx-auto mt-2">
        <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-6 flex flex-col gap-6 shadow-sm">
          
          {/* Header Row */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-[#F5F5F5]">Appointment Summary</h3>
            <span className="text-sm font-mono text-[#A1A1AA]">#{appointment.id}</span>
          </div>

          <div className="h-px bg-[#2C2C2C] -my-2" />

          {/* Summary Row */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1F1F1F] flex items-center justify-center overflow-hidden border border-[#2C2C2C]">
                <User className="w-5 h-5 text-[#E86A33]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[#F5F5F5] font-medium">{appointment.staffName || 'Wash Team'}</span>
                <span className="text-sm text-[#A1A1AA]">{appointment.packageName}</span>
                <span className="text-xs text-[#71717A]">{appointment.date} • {appointment.time}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm text-[#A1A1AA]">Total Amount</span>
              <span className="text-lg font-bold text-[#F5F5F5]">{appointment.price}</span>
            </div>
          </div>

          <div className="h-px bg-[#2C2C2C] -my-2" />

          {/* Reason for cancellation Textarea */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-[#A1A1AA] ml-1">
              Reason for cancellation *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
              className="w-full bg-[#101010] border text-[#F5F5F5] rounded-lg px-4 py-3 outline-none transition-all duration-200 placeholder:text-[#71717A] border-[#2C2C2C] focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] min-h-[120px] resize-y disabled:opacity-50"
              placeholder="Please let us know why you need to cancel this appointment..."
              required
            />
          </div>

          {/* Button Row */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)} 
              disabled={isSubmitting}
              className="!text-[#F5F5F5] !border-[#2C2C2C] hover:!border-[#E86A33] hover:!text-[#E86A33]"
            >
              Go Back
            </Button>
            <Button 
              variant="primary" 
              disabled={!reason.trim() || isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
              isLoading={isSubmitting}
              onClick={handleConfirmCancellation}
              className="!bg-red-600 hover:!bg-red-700 !text-white border-none"
            >
              Confirm Cancellation
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}

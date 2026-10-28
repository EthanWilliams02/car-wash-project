import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationsContext';
import { useToast } from '../../../contexts/ToastContext';
import { db } from '../../../lib/firebase';
import {
  updateAppointment,
  calculateCallOutFee,
  parseAppointmentDateTime,
  type StoredAppointment,
} from '../../../lib/appointments';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Calendar, Clock, Car, FileText, Hash, ArrowLeft, MapPin, AlertCircle, XCircle } from 'lucide-react';

const PACKAGE_PRICES: Record<string, number> = {
  'Express Wash': 75,
  'Premium Wash': 275,
  'Elite Wash': 875,
  'Premium Detail': 120,
  'Exterior & Interior Deep Clean': 150,
  'Standard Wash': 85,
};

export default function CustomerReschedule() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appointmentId: routeApptId } = useParams<{ appointmentId?: string }>();
  const { currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const { showToast } = useToast();
  
  const stateAppt = location.state?.appointment as StoredAppointment | undefined;
  const targetApptId = routeApptId || stateAppt?.id;
  const [appointment, setAppointment] = useState<StoredAppointment | null>(stateAppt || null);
  const [isLoading, setIsLoading] = useState(!stateAppt);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Subscribe to real-time appointment doc from Firestore to prevent overwriting newer admin updates
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
          } else {
            setErrorBanner('Appointment not found.');
          }
          setIsLoading(false);
        },
        (err) => {
          console.warn('Failed to listen to live appointment in CustomerReschedule:', err);
          setIsLoading(false);
        }
      );
      return () => unsub();
    } else {
      setIsLoading(false);
    }
  }, [currentUser?.uid, targetApptId, navigate]);

  const [hasMembership, setHasMembership] = useState<boolean>(() => {
    if (!currentUser?.uid) return false;
    const cached = localStorage.getItem(`ww_has_membership_${currentUser.uid}`);
    return cached ? JSON.parse(cached) : false;
  });

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
      if (snap.exists()) {
        const mem = snap.data()?.hasMembership === true;
        setHasMembership(mem);
        localStorage.setItem(`ww_has_membership_${currentUser.uid}`, JSON.stringify(mem));
      }
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(() => appointment?.date || todayStr);
  const [time, setTime] = useState(() => appointment?.time || '10:00');
  const [serviceType, setServiceType] = useState<'Call-out' | 'Drive-in'>(() => (appointment?.serviceType as any) || 'Call-out');
  const [streetAddress, setStreetAddress] = useState(() => appointment?.address || appointment?.location || '123 Main St, Apartment Complex');
  const [vehicle, setVehicle] = useState(() => appointment?.vehicle || 'Ford F-150');
  const [plate, setPlate] = useState('XYZ 1234');
  const [notes, setNotes] = useState(() => appointment?.notes || '');

  // Reset form state when incoming appointment changes (fixes stale form state bug)
  useEffect(() => {
    if (appointment) {
      setDate(appointment.date || todayStr);
      setTime(appointment.time || '10:00');
      setServiceType((appointment.serviceType as any) || 'Call-out');
      setStreetAddress(appointment.address || appointment.location || '123 Main St, Apartment Complex');
      setVehicle(appointment.vehicle || 'Ford F-150');
      setNotes(appointment.notes || '');
    }
  }, [appointment?.id, todayStr]);

  if (isLoading || !appointment) {
    return (
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-8 text-center text-[#A1A1AA]">
        Loading appointment details...
      </div>
    );
  }

  const isAlreadyCancelled = appointment.status === 'Cancelled';
  const isAlreadyCompleted = appointment.completed === true || appointment.status === 'Completed';

  // Dynamic calculations for base price, call-out fee, subtotal, VAT (15%), and total
  const parseBasePrice = (priceStr?: string, pkgName?: string): number => {
    if (pkgName && PACKAGE_PRICES[pkgName]) return PACKAGE_PRICES[pkgName];
    if (!priceStr) return 150;
    const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 150 : num;
  };

  const basePriceNum = parseBasePrice(appointment.price, appointment.packageName);
  const callOutFee = calculateCallOutFee(serviceType, hasMembership);
  const subtotalNum = basePriceNum + callOutFee;
  const vatNum = subtotalNum * 0.15;
  const totalNum = subtotalNum + vatNum;

  const formattedBasePrice = `R${basePriceNum.toFixed(2)}`;
  const formattedCallOutFee = `R${callOutFee.toFixed(2)}`;
  const formattedSubtotal = `R${subtotalNum.toFixed(2)}`;
  const formattedVat = `R${vatNum.toFixed(2)}`;
  const formattedTotal = `R${totalNum.toFixed(2)}`;

  const handleReschedule = async () => {
    setErrorBanner(null);

    if (isAlreadyCancelled) {
      showToast('Cannot reschedule a cancelled appointment.', 'error');
      return;
    }
    if (isAlreadyCompleted) {
      showToast('Cannot reschedule an already completed appointment.', 'error');
      return;
    }

    // Validate that the rescheduled date is not in the past
    const target = parseAppointmentDateTime(date, time);
    if (target && target.getTime() < Date.now()) {
      setErrorBanner('Rescheduled date and time cannot be in the past.');
      return;
    }

    const formattedAddress = serviceType === 'Call-out' ? streetAddress : '';

    setIsSubmitting(true);
    try {
      await updateAppointment(
        appointment.id,
        {
          ...appointment,
          date,
          time,
          serviceType,
          address: formattedAddress,
          location: formattedAddress,
          vehicle,
          notes,
          price: formattedTotal,
        },
        currentUser?.uid
      );

      addNotification({
        category: 'appointments',
        icon: 'clock',
        title: 'Appointment Rescheduled',
        message: `Your appointment for ${appointment.packageName} has been rescheduled to ${date} at ${time}.`,
        link: '/dashboard/customer/appointments',
        eventId: `appt-resched-${appointment.id}-${Date.now()}`,
      });

      showToast('Appointment rescheduled successfully', 'success');
      navigate('/dashboard/customer/appointments');
    } catch (err: any) {
      console.error('Customer reschedule failed:', err);
      showToast(err?.message || 'Failed to reschedule appointment. Please try again.', 'error');
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
          className="flex items-center gap-1.5 text-sm text-[#E86A33] hover:text-[#cc5a2a] transition-colors w-fit mb-2 cursor-pointer font-medium"
        >
          <ArrowLeft className="w-4 h-4 text-[#E86A33]" />
          Back to Appointments
        </button>
        <h2 className="text-2xl font-bold font-display tracking-tight text-[#F5F5F5]">Reschedule Appointment</h2>
        <p className="text-[#A1A1AA] text-sm">Choose a new date and time for your booking</p>
      </div>

      {/* Terminal State Alert */}
      {isAlreadyCancelled && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-400">Appointment is cancelled</h4>
            <p className="text-xs text-red-300/80 mt-1">
              Reason: "{appointment.cancelReason || 'Cancelled by administrator'}"
            </p>
          </div>
        </div>
      )}

      {isAlreadyCompleted && (
        <div className="p-4 rounded-xl bg-[#35B86B]/10 border border-[#35B86B]/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#35B86B] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-[#35B86B]">Appointment is completed</h4>
            <p className="text-xs text-[#35B86B]/80 mt-1">
              Completed bookings cannot be rescheduled.
            </p>
          </div>
        </div>
      )}

      {errorBanner && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium">
          {errorBanner}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column (Form) */}
        <div className="flex-[2] flex flex-col gap-6 bg-[#171717] border border-[#2C2C2C] rounded-xl p-6 shadow-sm">
          
          {/* Service Type Selection */}
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-[#F5F5F5]">Service Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setServiceType('Call-out')}
                disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
                className={`flex flex-col gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  serviceType === 'Call-out'
                    ? 'bg-[#E86A33]/10 border-[#E86A33] text-[#F5F5F5]'
                    : 'bg-[#101010] border-[#2C2C2C] text-[#A1A1AA] hover:border-[#E86A33]/40'
                } disabled:opacity-50`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#F5F5F5]">Call-out</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#E86A33]/20 text-[#E86A33] font-medium">
                    {hasMembership ? 'Free (Member)' : '+R150.00 Fee'}
                  </span>
                </div>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  We come directly to your address.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setServiceType('Drive-in')}
                disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
                className={`flex flex-col gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  serviceType === 'Drive-in'
                    ? 'bg-[#E86A33]/10 border-[#E86A33] text-[#F5F5F5]'
                    : 'bg-[#101010] border-[#2C2C2C] text-[#A1A1AA] hover:border-[#E86A33]/40'
                } disabled:opacity-50`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#F5F5F5]">Drive-in</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#35B86B]/20 text-[#35B86B] font-medium">Wash Bay</span>
                </div>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  Bring your vehicle to our wash bay facility.
                </p>
              </button>
            </div>

            {serviceType === 'Call-out' && (
              <div className="mt-2">
                <Input
                  label="Street Address / Location"
                  placeholder="e.g. 123 Main St, Apartment Complex"
                  value={streetAddress}
                  disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  icon={<MapPin className="w-5 h-5" />}
                  className="!bg-[#101010] !border-[#2C2C2C] !text-[#F5F5F5] focus:!border-[#E86A33] focus:!ring-[#E86A33]"
                  labelClassName="!text-[#A1A1AA]"
                  iconClassName="!text-[#E86A33]"
                  required
                />
              </div>
            )}
          </div>

          <div className="h-px bg-[#2C2C2C] my-1" />

          {/* Date & Time */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[#F5F5F5] mb-2">Date & Time</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                type="date"
                label="Select Date" 
                value={date}
                min={todayStr}
                disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
                onChange={(e) => setDate(e.target.value)}
                icon={<Calendar className="w-5 h-5" />} 
                className="!bg-[#101010] !border-[#2C2C2C] !text-[#F5F5F5] focus:!border-[#E86A33] focus:!ring-[#E86A33] [color-scheme:dark]"
                labelClassName="!text-[#A1A1AA]"
                iconClassName="!text-[#E86A33]"
              />
              <Input 
                type="time"
                label="Select Time" 
                value={time}
                disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
                onChange={(e) => setTime(e.target.value)}
                icon={<Clock className="w-5 h-5" />} 
                className="!bg-[#101010] !border-[#2C2C2C] !text-[#F5F5F5] focus:!border-[#E86A33] focus:!ring-[#E86A33] [color-scheme:dark]"
                labelClassName="!text-[#A1A1AA]"
                iconClassName="!text-[#E86A33]"
              />
            </div>
          </div>

          <div className="h-px bg-[#2C2C2C] my-2" />

          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[#F5F5F5] mb-2">Vehicle Details</h3>
            <Input 
              label="Licence Plate" 
              value={plate}
              disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
              onChange={(e) => setPlate(e.target.value)}
              icon={<Hash className="w-5 h-5" />} 
              className="!bg-[#101010] !border-[#2C2C2C] !text-[#F5F5F5] focus:!border-[#E86A33] focus:!ring-[#E86A33]"
              labelClassName="!text-[#A1A1AA]"
              iconClassName="!text-[#E86A33]"
            />
            <Input 
              label="Vehicle Make & Model" 
              value={vehicle}
              disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
              onChange={(e) => setVehicle(e.target.value)}
              icon={<Car className="w-5 h-5" />} 
              className="!bg-[#101010] !border-[#2C2C2C] !text-[#F5F5F5] focus:!border-[#E86A33] focus:!ring-[#E86A33]"
              labelClassName="!text-[#A1A1AA]"
              iconClassName="!text-[#E86A33]"
            />
            <Input 
              label="Reason for reschedule (Optional)" 
              placeholder="e.g. Schedule conflict"
              value={notes}
              disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
              onChange={(e) => setNotes(e.target.value)}
              icon={<FileText className="w-5 h-5" />} 
              className="!bg-[#101010] !border-[#2C2C2C] !text-[#F5F5F5] placeholder:!text-[#71717A] focus:!border-[#E86A33] focus:!ring-[#E86A33]"
              labelClassName="!text-[#A1A1AA]"
              iconClassName="!text-[#E86A33]"
            />
          </div>
        </div>

        {/* Right Column (Summary) */}
        <div className="flex-1">
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-6 flex flex-col gap-5 sticky top-24 shadow-sm">
            <h3 className="text-lg font-semibold text-[#F5F5F5]">New booking summary</h3>
            
            <div className="flex flex-col gap-1">
              <span className="text-[#A1A1AA] text-sm">Package Selected</span>
              <div className="flex justify-between items-center mt-1">
                <span className="font-medium text-[#F5F5F5]">{appointment.packageName || 'Exterior & Interior Deep Clean'}</span>
                <span className="font-semibold text-[#F5F5F5]">{formattedBasePrice}</span>
              </div>
              <span className="text-[#71717A] text-sm mt-1">Duration: ~1.5 hours</span>
            </div>

            <div className="h-px bg-[#2C2C2C]" />

            <div className="flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-[#A1A1AA] text-sm">Service Type</span>
                <span className="font-medium text-[#F5F5F5]">{serviceType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A1A1AA] text-sm">Date</span>
                <span className="font-medium text-[#F5F5F5]">{date || appointment.date || 'Not selected'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A1A1AA] text-sm">Time</span>
                <span className="font-medium text-[#F5F5F5]">{time || appointment.time || 'Not selected'}</span>
              </div>
            </div>

            <div className="h-px bg-[#2C2C2C]" />

            <div className="flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-[#A1A1AA] text-sm">Package Price</span>
                <span className="font-medium text-[#F5F5F5]">{formattedBasePrice}</span>
              </div>

              {callOutFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#A1A1AA] text-sm">Call-out Fee</span>
                  <span className="font-medium text-[#E86A33]">{formattedCallOutFee}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-[#A1A1AA] text-sm">Subtotal</span>
                <span className="font-medium text-[#F5F5F5]">{formattedSubtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A1A1AA] text-sm">VAT (15%)</span>
                <span className="font-medium text-[#F5F5F5]">{formattedVat}</span>
              </div>
              <div className="flex justify-between mt-2 pt-3 border-t border-[#2C2C2C]">
                <span className="font-bold text-[#F5F5F5]">Total</span>
                <span className="font-bold text-[#E86A33] text-lg">{formattedTotal}</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              fullWidth 
              onClick={handleReschedule}
              disabled={isAlreadyCancelled || isAlreadyCompleted || isSubmitting}
              isLoading={isSubmitting}
              className="mt-4 !border-[#E86A33] !text-[#E86A33] hover:!bg-[#E86A33]/10 hover:!border-[#E86A33]"
            >
              Confirm Reschedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

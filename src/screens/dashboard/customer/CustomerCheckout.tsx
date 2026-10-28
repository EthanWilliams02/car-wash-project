import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import PaymentSuccessModal, { type PaymentSuccessInfo } from '../../../components/ui/PaymentSuccessModal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationsContext';
import { saveAppointment, calculateCallOutFee, type StoredAppointment } from '../../../lib/appointments';
import {
  calculateBookingPoints,
  awardBookingPoints,
  getRewardsSummary,
  LOYALTY_TIERS,
  getValidVouchers,
  getVoucherDiscount,
  markVoucherUsed,
  type RedeemedReward,
} from '../../../lib/rewards';
import {
  ArrowLeft,
  CreditCard,
  Check,
  Clock,
  Calendar,
  Sparkles,
  Droplets,
  ShieldCheck,
  Lock,
  Award,
  Smartphone,
  Wallet,
  MapPin,
  User,
} from 'lucide-react';

// ─── Package catalogue matching CustomerBooking ──────────────────────────────
const PACKAGES: Record<string, { name: string; price: number; duration: string; accentColor: string }> = {
  express: { name: 'Express Wash',  price: 75,  duration: '20–30 min', accentColor: '#A1A1AA' },
  premium: { name: 'Premium Wash', price: 275, duration: '60–75 min', accentColor: '#E86A33' },
  elite:   { name: 'Elite Wash',   price: 875, duration: '2–3 hrs',   accentColor: '#35B86B' },
};

const PKG_ICON: Record<string, React.ReactNode> = {
  express: <Droplets className="w-4 h-4" />,
  premium: <Sparkles className="w-4 h-4" />,
  elite:   <ShieldCheck className="w-4 h-4" />,
  custom:  <Sparkles className="w-4 h-4" />,
};

const INCLUDED: Record<string, string[]> = {
  express: ['Exterior hand wash', 'Wheel rinse', 'Window wipe-down', 'Quick interior vacuum'],
  premium: ['Full exterior wash & dry', 'Interior vacuum & wipe-down', 'Tyre dressing & rim shine', 'Window clean (inside & out)', 'Air freshener finish'],
  elite:   ['Everything in Premium', 'Clay bar & paint correction', 'Ceramic coating application', 'Full leather conditioning', 'Engine bay clean'],
  custom:  ['Tailored wash selection', 'Dedicated professional staff', 'WashWizzy satisfaction guarantee'],
};

const VAT = 0.15;
function fmt(n: number) { return `R${n.toFixed(2)}`; }

type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay';

// ─── SectionCard matching CustomerBooking ────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-6 flex flex-col gap-5 shadow-lg">
      <h3 className="text-[15px] font-semibold font-display text-[#F5F5F5] tracking-tight border-b border-[#2C2C2C] pb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── SummaryRow helper ───────────────────────────────────────────────────────
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#A1A1AA]">{label}</span>
      <span className="text-sm font-medium text-[#F5F5F5]">{value}</span>
    </div>
  );
}

interface BookingNavState {
  packageId?: string;
  price?: number;
  serviceType?: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  date?: string;
  time?: string;
  plate?: string;
  vehicle?: string;
  notes?: string;
  customOptionCount?: number;
}

export default function CustomerCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const { addNotification } = useNotifications();

  // Read booking details from navigation state with safe fallbacks
  const navState = (location.state as BookingNavState | null) || {};
  const packageId: string = navState.packageId || 'premium';
  const pkg = PACKAGES[packageId] || {
    name: packageId === 'custom' ? 'Custom Package' : 'Premium Wash',
    price: navState.price || 275,
    duration: '60–75 min',
    accentColor: '#E86A33',
  };

  const bookingDate: string = navState.date || '';
  const bookingTime: string = navState.time || '';
  const bookingPlate: string = navState.plate || '';
  const bookingVehicle: string = navState.vehicle || '';
  const bookingNotes: string = navState.notes || '';
  const serviceType: string = navState.serviceType || 'Call-out';
  const customOptionCount: number = navState.customOptionCount || 0;

  const [hasMembership, setHasMembership] = useState<boolean>(() => {
    if (!currentUser?.uid) return false;
    const cached = localStorage.getItem(`ww_has_membership_${currentUser.uid}`);
    return cached ? JSON.parse(cached) : false;
  });

  // Voucher state
  const [appliedVoucher, setAppliedVoucher] = useState<RedeemedReward | null>(null);

  const [userProfile, setUserProfile] = useState<{ fullName?: string; phoneNumber?: string } | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const mem = data?.hasMembership === true;
        setHasMembership(mem);
        setUserProfile({
          fullName: data?.fullName || data?.displayName,
          phoneNumber: data?.phoneNumber,
        });
        localStorage.setItem(`ww_has_membership_${currentUser.uid}`, JSON.stringify(mem));
      }
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Load and auto-select valid voucher for current user
  useEffect(() => {
    const vouchers = getValidVouchers(currentUser?.uid);
    if (vouchers.length > 0) {
      // Find voucher that applies to current package
      const matching = vouchers.find((v) => getVoucherDiscount(v, pkg.name, pkg.price).applies);
      if (matching) {
        setAppliedVoucher(matching);
      } else {
        // If there's an unused voucher, set it as applied so the incompatibility reason displays
        setAppliedVoucher(vouchers[0]);
      }
    } else {
      setAppliedVoucher(null);
    }
  }, [currentUser?.uid, pkg.name, pkg.price]);

  const displayDate = bookingDate
    ? new Date(bookingDate).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Oct 26, 2026';
  const displayTime = bookingTime || '10:00 AM';

  // Evaluate voucher discount
  const voucherResult = appliedVoucher
    ? getVoucherDiscount(appliedVoucher, pkg.name, pkg.price)
    : null;
  const discountAmount = voucherResult?.applies ? voucherResult.discountAmount : 0;

  const callOutFee = calculateCallOutFee(serviceType, hasMembership);
  const discountedPkgPrice = Math.max(0, pkg.price - discountAmount);
  const subtotal = discountedPkgPrice + callOutFee;
  const vat = subtotal * VAT;
  const total = subtotal + vat;

  // Points calculation: Express=50, Premium=100, Elite=150, Custom=15*options (multipliers only apply to members)
  const rewardsSummary = getRewardsSummary(currentUser?.uid);
  const currentTierObj = LOYALTY_TIERS[rewardsSummary.currentTier] || LOYALTY_TIERS.Unranked;
  const pointsEarned = calculateBookingPoints(pkg.name, customOptionCount, hasMembership, currentTierObj.multiplier);

  // Form State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('card');
  const [cardHolder, setCardHolder] = useState(currentUser?.displayName || 'Qaasim Isaacs');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [streetAddress, setStreetAddress] = useState(navState.streetAddress || '123 Bree Street');
  const [city, setCity] = useState(navState.city || 'Cape Town');
  const [postalCode, setPostalCode] = useState('8001');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [paymentSuccessInfo, setPaymentSuccessInfo] = useState<PaymentSuccessInfo | null>(null);

  // Format Card Number (adds space every 4 digits)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
    if (errors.cardNumber) setErrors((prev) => ({ ...prev, cardNumber: '' }));
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setCardExpiry(raw);
    if (errors.cardExpiry) setErrors((prev) => ({ ...prev, cardExpiry: '' }));
  };

  // Format CVV (3-4 digits)
  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardCvv(raw);
    if (errors.cardCvv) setErrors((prev) => ({ ...prev, cardCvv: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (paymentMethod === 'card') {
      if (!cardHolder.trim()) newErrors.cardHolder = 'Cardholder name is required';
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (!cleanCard || cleanCard.length < 15) {
        newErrors.cardNumber = 'Valid 16-digit card number required';
      }
      if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        newErrors.cardExpiry = 'Expiry must be MM/YY';
      }
      if (!cardCvv || cardCvv.length < 3) {
        newErrors.cardCvv = 'Valid 3 or 4 digit CVV required';
      }
      if (serviceType === 'Call-out') {
        if (!streetAddress.trim()) newErrors.streetAddress = 'Street address is required';
        if (!city.trim()) newErrors.city = 'City is required';
        if (!postalCode.trim()) newErrors.postalCode = 'Postal code is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) return; // Prevent duplicate submissions

    if (!validateForm()) {
      showToast('Please check the required payment fields.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const formattedAddress = serviceType === 'Call-out' ? (streetAddress ? `${streetAddress}, ${city}` : '123 Main St, Apartment Complex') : '';
      const apptId = `WW-${Math.floor(100000 + Math.random() * 900000)}`;

      // Create new appointment and save to localStorage / Firestore
      const customerName = userProfile?.fullName || currentUser?.displayName || cardHolder || 'Customer';
      const customerEmail = currentUser?.email || '';
      const customerPhone = userProfile?.phoneNumber || currentUser?.phoneNumber || '';

      const newAppointment: StoredAppointment = {
        id: apptId,
        customerUid: currentUser?.uid,
        customerName,
        customerEmail,
        customerPhone,
        packageName: pkg.name,
        price: fmt(total),
        date: displayDate,
        time: displayTime,
        serviceType,
        address: formattedAddress,
        location: formattedAddress,
        vehicle: bookingVehicle ? `${bookingVehicle}${bookingPlate ? ` (${bookingPlate})` : ''}` : 'Tesla Model 3',
        notes: bookingNotes || '',
        confirmed: false,
        status: 'Awaiting Confirmation',
        statusColor: 'amber',
        staffName: 'Pending Assignment',
        staffStatus: 'Finding Staff...',
        isLocked: false,
        cancellationPolicy: 'This booking is awaiting confirmation from our team.',
        createdAt: Date.now(),
      };

      // Critical: Save appointment to database must succeed before confirming payment
      await saveAppointment(newAppointment, currentUser?.uid);

      // 1. Appointment Booked notification
      try {
        addNotification({
          category: 'appointments',
          icon: 'calendar',
          title: 'Appointment Booked',
          message: `Your appointment for ${pkg.name} has been successfully booked for ${displayDate} at ${displayTime}.`,
          link: '/dashboard/customer/appointments',
          eventId: `appt-booked-${newAppointment.id}`,
        });
      } catch (e) {
        console.warn('Notification 1 error caught:', e);
      }

      // 2. Payment Successful notification
      try {
        addNotification({
          category: 'system',
          icon: 'check',
          title: 'Payment Successful',
          message: `Your payment of ${fmt(total)} for ${pkg.name} was processed successfully.`,
          link: '/dashboard/customer/profile',
          eventId: `pay-success-${newAppointment.id}`,
        });
      } catch (e) {
        console.warn('Notification 2 error caught:', e);
      }
      
      // Mark voucher as used ONLY after successful booking / payment
      if (appliedVoucher && voucherResult?.applies) {
        try {
          markVoucherUsed(appliedVoucher.id, currentUser?.uid);
          // 3. Promotion/Voucher Redeemed notification
          addNotification({
            category: 'promotions',
            icon: 'gift',
            title: 'Promotion Redeemed',
            message: `Your "${appliedVoucher.rewardTitle}" promotion has been successfully applied to your booking.`,
            link: '/dashboard/customer/packages',
            eventId: `voucher-used-${appliedVoucher.id}-${newAppointment.id}`,
          });
        } catch (e) {
          console.warn('Voucher notification error caught:', e);
        }
      }

      // Award reward points idempotently with fixed values
      try {
        await awardBookingPoints(currentUser?.uid, newAppointment.id, pkg.name, customOptionCount);
      } catch (e) {
        console.warn('awardBookingPoints error caught:', e);
      }

      // 4. Reward Points Added notification
      if (pointsEarned > 0) {
        try {
          addNotification({
            category: 'rewards',
            icon: 'star',
            title: 'Reward Points Added',
            message: `You've earned ${pointsEarned} reward points for your recent ${pkg.name}.`,
            link: '/dashboard/customer/rewards',
            eventId: `points-awarded-${newAppointment.id}`,
          });
        } catch (e) {
          console.warn('Points notification error caught:', e);
        }
      }

      showToast(`Payment of ${fmt(total)} confirmed! +${pointsEarned} reward points added.`, 'success');

      setPaymentSuccessInfo({
        itemName: pkg.name,
        amount: fmt(total),
        paymentType: 'appointment',
        appointmentDate: displayDate,
        appointmentTime: displayTime,
        reference: newAppointment.id,
      });
      setShowPaymentSuccess(true);
    } catch (err: any) {
      console.error('Payment / booking database write failed:', err);
      showToast(err?.message || 'Failed to complete booking. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards text-[#F5F5F5]">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-1">
        <button
          onClick={() => navigate('/dashboard/customer/booking', { state: navState })}
          className="flex items-center gap-1.5 text-sm text-[#E86A33] hover:opacity-80 transition-opacity w-fit mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Booking
        </button>
        <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-[#F5F5F5]">
          Checkout
        </h2>
        <p className="text-[#A1A1AA] text-sm md:text-[15px]">
          Review your booking and complete payment
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <form onSubmit={handlePayment} className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ────────── LEFT: Payment & Billing ──────────────────── */}
        <div className="flex-[2] flex flex-col gap-5 w-full">

          {/* Payment Method Selector */}
          <SectionCard title="Payment Method">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-center transition-all duration-150 ${
                  paymentMethod === 'card'
                    ? 'bg-[#E86A33]/10 border-[#E86A33] text-[#F5F5F5] shadow-md shadow-[#E86A33]/15'
                    : 'bg-[#101010] border-[#2C2C2C] text-[#A1A1AA] hover:border-[#3C3C3C] hover:text-[#F5F5F5]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  paymentMethod === 'card' ? 'bg-[#E86A33]/20 text-[#E86A33]' : 'bg-[#1F1F1F] text-[#71717A]'
                }`}>
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Credit / Debit Card</span>
              </button>

              {/* Apple Pay Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('apple_pay')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-center transition-all duration-150 ${
                  paymentMethod === 'apple_pay'
                    ? 'bg-[#E86A33]/10 border-[#E86A33] text-[#F5F5F5] shadow-md shadow-[#E86A33]/15'
                    : 'bg-[#101010] border-[#2C2C2C] text-[#A1A1AA] hover:border-[#3C3C3C] hover:text-[#F5F5F5]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  paymentMethod === 'apple_pay' ? 'bg-[#E86A33]/20 text-[#E86A33]' : 'bg-[#1F1F1F] text-[#71717A]'
                }`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Apple Pay</span>
              </button>

              {/* Google Pay Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('google_pay')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-center transition-all duration-150 ${
                  paymentMethod === 'google_pay'
                    ? 'bg-[#E86A33]/10 border-[#E86A33] text-[#F5F5F5] shadow-md shadow-[#E86A33]/15'
                    : 'bg-[#101010] border-[#2C2C2C] text-[#A1A1AA] hover:border-[#3C3C3C] hover:text-[#F5F5F5]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  paymentMethod === 'google_pay' ? 'bg-[#E86A33]/20 text-[#E86A33]' : 'bg-[#1F1F1F] text-[#71717A]'
                }`}>
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Google Pay</span>
              </button>
            </div>

            {/* Card Inputs if Card is selected */}
            {paymentMethod === 'card' ? (
              <div className="flex flex-col gap-4 mt-2">
                <Input
                  label="Cardholder Name *"
                  placeholder="e.g. Qaasim Isaacs"
                  value={cardHolder}
                  onChange={(e) => {
                    setCardHolder(e.target.value);
                    if (errors.cardHolder) setErrors((prev) => ({ ...prev, cardHolder: '' }));
                  }}
                  error={errors.cardHolder}
                  icon={<User className="w-4 h-4" />}
                />

                <Input
                  label="Card Number *"
                  placeholder="4000 1234 5678 9010"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  error={errors.cardNumber}
                  maxLength={19}
                  icon={<CreditCard className="w-4 h-4" />}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Expiry Date (MM/YY) *"
                    placeholder="12/28"
                    value={cardExpiry}
                    onChange={handleExpiryChange}
                    error={errors.cardExpiry}
                    maxLength={5}
                    icon={<Calendar className="w-4 h-4" />}
                  />
                  <Input
                    label="CVV / CVC *"
                    type="password"
                    placeholder="123"
                    value={cardCvv}
                    onChange={handleCvvChange}
                    error={errors.cardCvv}
                    maxLength={4}
                    icon={<Lock className="w-4 h-4" />}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-[#101010] border border-[#2C2C2C] rounded-xl p-4 flex items-center gap-3 mt-2">
                <div className="w-8 h-8 rounded-lg bg-[#E86A33]/15 text-[#E86A33] flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  You will be prompted to authorize your payment securely using{' '}
                  <span className="text-[#F5F5F5] font-semibold">
                    {paymentMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay'}
                  </span>{' '}
                  when you click the Pay button.
                </p>
              </div>
            )}
          </SectionCard>

          {/* Billing Address Section */}
          <SectionCard title="Billing Address">
            <div className="flex flex-col gap-4">
              <Input
                label="Street Address *"
                placeholder="e.g. 123 Bree Street"
                value={streetAddress}
                onChange={(e) => {
                  setStreetAddress(e.target.value);
                  if (errors.streetAddress) setErrors((prev) => ({ ...prev, streetAddress: '' }));
                }}
                error={errors.streetAddress}
                icon={<MapPin className="w-4 h-4" />}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="City *"
                  placeholder="e.g. Cape Town"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (errors.city) setErrors((prev) => ({ ...prev, city: '' }));
                  }}
                  error={errors.city}
                />
                <Input
                  label="Postal Code *"
                  placeholder="e.g. 8001"
                  value={postalCode}
                  onChange={(e) => {
                    setPostalCode(e.target.value);
                    if (errors.postalCode) setErrors((prev) => ({ ...prev, postalCode: '' }));
                  }}
                  error={errors.postalCode}
                />
              </div>
            </div>
          </SectionCard>

          {/* Security & Guarantee Note */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#171717] border border-[#2C2C2C] text-xs text-[#A1A1AA]">
            <ShieldCheck className="w-5 h-5 text-[#35B86B] shrink-0" />
            <span>
              All transactions are encrypted with 256-bit SSL security. Your card details are safely processed according to PCI-DSS standards.
            </span>
          </div>

        </div>

        {/* ────────── RIGHT: Booking Summary ───────────────────── */}
        <div className="w-full lg:w-[340px] shrink-0">
          <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-6 flex flex-col gap-5 sticky top-24 shadow-lg relative overflow-hidden">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#E86A33] via-[#E86A33]/50 to-transparent" />

            {/* Header with Loyalty Points earned badge */}
            <div className="flex items-center justify-between border-b border-[#2C2C2C] pb-3">
              <h3 className="text-[15px] font-semibold font-display text-[#F5F5F5] tracking-tight">
                Booking Summary
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30">
                <Award className="w-3 h-3" />
                +{pointsEarned} PTS
              </span>
            </div>

            {/* Selected Package */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-widest text-[#71717A] font-semibold">Package</span>
              <div className="flex items-center justify-between mt-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: `${pkg.accentColor}18`, color: pkg.accentColor }}
                  >
                    {PKG_ICON[packageId] || <Sparkles className="w-4 h-4" />}
                  </span>
                  <span className="font-semibold text-[#F5F5F5] text-sm">{pkg.name}</span>
                </div>
                <span className="font-bold text-[#F5F5F5] text-sm">{fmt(pkg.price)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-[#71717A]">
                <Clock className="w-3.5 h-3.5 text-[#E86A33]" />
                Duration: {pkg.duration}
              </div>
            </div>

            <div className="h-px bg-[#2C2C2C]" />

            {/* Appointment Schedule & Vehicle */}
            <div className="flex flex-col gap-2.5">
              <SummaryRow label="Date" value={displayDate} />
              <SummaryRow label="Time" value={displayTime} />
              {bookingVehicle && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A1A1AA]">Vehicle</span>
                  <span className="font-medium text-[#F5F5F5] truncate max-w-[170px]">
                    {bookingVehicle} {bookingPlate ? `(${bookingPlate})` : ''}
                  </span>
                </div>
              )}
              {bookingNotes && (
                <div className="flex items-start justify-between text-xs">
                  <span className="text-[#A1A1AA]">Notes</span>
                  <span className="text-[#D4D4D4] text-right truncate max-w-[170px]">
                    {bookingNotes}
                  </span>
                </div>
              )}
            </div>

            {/* ── Redeemed Reward / Voucher Section ── */}
            {appliedVoucher && (
              <>
                <div className="h-px bg-[#2C2C2C]" />
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] uppercase tracking-widest text-[#71717A] font-semibold">
                    Redeemed Reward
                  </span>

                  <div className="bg-[#101010] border border-[#2C2C2C] rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#F5F5F5] truncate">
                          {appliedVoucher.rewardTitle}
                        </span>
                        <span className="text-[11px] font-mono text-[#A1A1AA] mt-0.5">
                          Voucher: {appliedVoucher.voucherCode}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30 shrink-0">
                        <Check className="w-3 h-3" />
                        Redeemed
                      </span>
                    </div>

                    {voucherResult?.applies ? (
                      <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2C]/60 text-xs">
                        <span className="text-[#A1A1AA]">Discount</span>
                        <span className="font-bold text-[#35B86B]">-{fmt(discountAmount)}</span>
                      </div>
                    ) : (
                      <div className="pt-1 text-[11px] text-amber-400/90 leading-tight">
                        {voucherResult?.reason || 'This voucher is not applicable to the selected package.'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-[#2C2C2C]" />

            {/* Price breakdown */}
            <div className="flex flex-col gap-2.5">
              <SummaryRow label="Package Price" value={fmt(pkg.price)} />
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-[#35B86B]">
                  <span>Discount</span>
                  <span className="font-semibold">-{fmt(discountAmount)}</span>
                </div>
              )}
              {callOutFee > 0 && <SummaryRow label="Call-out Fee" value={fmt(callOutFee)} />}
              <SummaryRow label="Subtotal" value={fmt(subtotal)} />
              <SummaryRow label="VAT (15%)" value={fmt(vat)} />
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-[#2C2C2C]">
                <span className="font-bold text-[#F5F5F5]">Total Due</span>
                <span className="font-bold text-[#E86A33] text-xl">{fmt(total)}</span>
              </div>
            </div>

            {/* Included Checklist */}
            <div className="bg-[#101010] border border-[#2C2C2C] rounded-xl p-4 flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#71717A] mb-0.5">
                Included with your wash
              </p>
              {(INCLUDED[packageId] || INCLUDED.premium).map((item: string) => (
                <div key={item} className="flex items-center gap-2 text-xs text-[#D4D4D4]">
                  <Check className="w-3.5 h-3.5 text-[#E86A33] shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            {/* Pay Button */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              className="gap-2 text-base py-3.5"
            >
              <CreditCard className="w-4 h-4" />
              Pay {fmt(total)}
            </Button>

            <p className="text-[11px] text-center text-[#71717A] leading-relaxed">
              By confirming, your payment method will be charged and you agree to our{' '}
              <span className="text-[#E86A33] cursor-pointer hover:underline">
                terms of service
              </span>
              .
            </p>
          </div>
        </div>

      </form>

      {/* ── Success Confirmation Modal ── */}
      <PaymentSuccessModal
        open={showPaymentSuccess}
        paymentInfo={paymentSuccessInfo}
        onDone={() => {
          setShowPaymentSuccess(false);
          setPaymentSuccessInfo(null);
          navigate('/dashboard/customer/appointments');
        }}
        doneText="View My Appointments"
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import { getStoredAppointments, getDynamicAppointmentStatus, getAppointmentsStorageKey, type StoredAppointment } from '../../../lib/appointments';
import { Button } from '../../../components/ui/Button';
import { Lock, Calendar, Clock, MapPin, User, UserCheck, ChevronRight } from 'lucide-react';

const DEFAULT_MOCK_APPOINTMENTS: StoredAppointment[] = [
  {
    id: 'mock-appt-1',
    status: 'Staff on route',
    statusColor: 'blue',
    date: 'Today, Oct 24',
    time: '2:00 PM - 3:00 PM',
    serviceType: 'Call-out',
    location: '123 Main St, Apartment Complex',
    address: '123 Main St, Apartment Complex',
    vehicle: 'Tesla Model 3',
    price: 'R120.00',
    packageName: 'Premium Detail',
    staffName: 'Michael R.',
    staffStatus: 'On Route - 15 mins away',
    isLocked: true,
    completed: false,
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'mock-appt-2',
    status: 'Scheduled',
    statusColor: 'burnt-orange',
    date: 'Tomorrow, Oct 25',
    time: '10:00 AM - 11:30 AM',
    serviceType: 'Call-out',
    location: '456 Oak Ave, Driveway',
    address: '456 Oak Ave, Driveway',
    vehicle: 'Ford F-150',
    price: 'R150.00',
    packageName: 'Exterior & Interior Deep Clean',
    staffName: 'Sarah J.',
    staffStatus: 'Assigned',
    isLocked: false,
    completed: false,
    cancellationPolicy: 'Cancel before Oct 24, 10:00 AM for a full refund. 20% fee applies thereafter.',
    createdAt: Date.now() - 7200000,
  },
  {
    id: 'mock-appt-3',
    status: 'Refund Eligible',
    statusColor: 'reward-green',
    date: 'Fri, Oct 27',
    time: '1:00 PM - 2:00 PM',
    serviceType: 'Drive-in',
    location: '',
    address: '',
    vehicle: 'Honda Civic',
    price: 'R85.00',
    packageName: 'Standard Wash',
    staffName: 'Pending Assignment',
    staffStatus: 'Finding Staff...',
    isLocked: false,
    completed: false,
    cancellationPolicy: 'Cancel before Oct 26, 1:00 PM for a full refund.',
    createdAt: Date.now() - 10800000,
  },
  {
    id: 'mock-appt-4',
    status: 'Missed',
    statusColor: 'red',
    date: 'Mon, Oct 20',
    time: '9:00 AM - 10:00 AM',
    serviceType: 'Call-out',
    location: '123 Main St, Apartment Complex',
    address: '123 Main St, Apartment Complex',
    vehicle: 'Tesla Model 3',
    price: 'R120.00',
    packageName: 'Premium Detail',
    staffName: 'Michael R.',
    staffStatus: 'Was Assigned',
    isLocked: true,
    completed: false,
    cancellationPolicy: 'You missed this appointment. Refund requests are subject to approval.',
    createdAt: Date.now() - 86400000 * 5,
  },
];

export default function CustomerAppointments() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [storedAppointments, setStoredAppointments] = useState<StoredAppointment[]>(() => {
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

  // Listen to Firestore real-time updates for user appointments
  useEffect(() => {
    if (!currentUser?.uid) {
      setStoredAppointments([]);
      return;
    }

    const apptsRef = collection(db, 'users', currentUser.uid, 'appointments');
    const q = query(apptsRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: StoredAppointment[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as StoredAppointment);
      });
      setStoredAppointments(list);
      localStorage.setItem(getAppointmentsStorageKey(currentUser.uid), JSON.stringify(list));
    }, (err) => {
      console.error('Failed to listen to user appointments in Firestore', err);
      setStoredAppointments(getStoredAppointments(currentUser.uid));
    });

    return () => unsub();
  }, [currentUser?.uid]);

  // Listen to user profile membership status
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
      if (snap.exists()) {
        const mem = snap.data()?.hasMembership === true;
        setHasMembership(mem);
        localStorage.setItem(`ww_has_membership_${currentUser.uid}`, JSON.stringify(mem));
      }
    }, (err) => {
      console.error("Failed to load user membership status", err);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // If user is signed in, only display their own appointments (empty for new users).
  // If not signed in (demo/guest), fall back to default demo mock cards.
  const allAppointments = currentUser?.uid
    ? storedAppointments
    : DEFAULT_MOCK_APPOINTMENTS;

  const upcomingAppointments = allAppointments.filter((appt) => {
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

  const historyAppointments = allAppointments.filter((appt) => {
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
    return dyn.status === 'Missed' || dyn.status === 'Completed' || dyn.status === 'Cancelled';
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards text-[#F5F5F5]">
      {/* TopHeader/Title area */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold font-display tracking-tight text-[#F5F5F5]">My Appointments</h2>
        <p className="text-[#A1A1AA] text-sm">Manage your upcoming bookings and requests</p>
      </div>

      {/* Tabs and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2C2C2C] pb-4">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`font-medium text-[15px] pb-4 -mb-[17px] transition-colors cursor-pointer ${activeTab === 'upcoming' ? 'text-[#E86A33] border-b-2 border-[#E86A33]' : 'text-[#A1A1AA] hover:text-[#F5F5F5]'}`}
          >
            Upcoming Appointments ({upcomingAppointments.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`font-medium text-[15px] pb-4 -mb-[17px] transition-colors cursor-pointer ${activeTab === 'history' ? 'text-[#E86A33] border-b-2 border-[#E86A33]' : 'text-[#A1A1AA] hover:text-[#F5F5F5]'}`}
          >
            History ({historyAppointments.length})
          </button>
        </div>
        <Button variant="primary" onClick={() => navigate('/dashboard/customer/packages')}>
          + Book New Appointment
        </Button>
      </div>

      {/* Cards List */}
      <div className="flex flex-col gap-4">
        
        {activeTab === 'upcoming' && (
          <>
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((appt) => {
                const dynamic = getDynamicAppointmentStatus(
                  appt.date,
                  appt.time,
                  appt.status === 'Missed',
                  appt.completed,
                  hasMembership,
                  appt.status,
                  appt.confirmed,
                  appt.staffStatus
                );
                return (
                  <AppointmentCard
                    key={appt.id}
                    id={appt.id}
                    date={appt.date}
                    time={appt.time}
                    serviceType={appt.serviceType}
                    address={appt.address}
                    location={appt.location}
                    vehicle={appt.vehicle}
                    price={appt.price}
                    packageName={appt.packageName}
                    staffName={appt.staffName}
                    staffStatus={appt.staffStatus}
                    completed={appt.completed}
                    confirmed={appt.confirmed}
                    hasMembership={hasMembership}
                    rescheduledByOwner={appt.rescheduledByOwner}
                    previousSchedule={appt.previousSchedule}
                    cancelReason={appt.cancelReason}
                    onReschedule={() => {
                      navigate(`/dashboard/customer/appointments/reschedule/${appt.id}`, {
                        state: {
                          appointment: {
                            ...appt,
                            status: dynamic.status,
                            statusColor: dynamic.statusColor,
                            isLocked: dynamic.isLocked,
                            cancellationPolicy: dynamic.cancellationPolicy,
                          },
                        },
                      });
                    }}
                    onCancel={() => {
                      navigate(`/dashboard/customer/appointments/cancel/${appt.id}`, {
                        state: {
                          appointment: {
                            ...appt,
                            status: dynamic.status,
                            statusColor: dynamic.statusColor,
                            isLocked: dynamic.isLocked,
                            cancellationPolicy: dynamic.cancellationPolicy,
                          },
                        },
                      });
                    }}
                  />
                );
              })
            ) : (
              <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-8 text-center text-[#A1A1AA]">
                No upcoming appointments
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            {historyAppointments.length > 0 ? (
              historyAppointments.map((appt) => {
                const dynamic = getDynamicAppointmentStatus(
                  appt.date,
                  appt.time,
                  appt.status === 'Missed',
                  appt.completed,
                  hasMembership,
                  appt.status,
                  appt.confirmed,
                  appt.staffStatus
                );
                return (
                  <AppointmentCard
                    key={appt.id}
                    id={appt.id}
                    date={appt.date}
                    time={appt.time}
                    serviceType={appt.serviceType}
                    address={appt.address}
                    location={appt.location}
                    vehicle={appt.vehicle}
                    price={appt.price}
                    packageName={appt.packageName}
                    staffName={appt.staffName}
                    staffStatus={appt.staffStatus}
                    isMissed={dynamic.status === 'Missed'}
                    isCancelled={dynamic.status === 'Cancelled' || appt.status === 'Cancelled'}
                    completed={appt.completed}
                    confirmed={appt.confirmed}
                    hasMembership={hasMembership}
                    rescheduledByOwner={appt.rescheduledByOwner}
                    previousSchedule={appt.previousSchedule}
                    cancelReason={appt.cancelReason}
                    onReschedule={() => {
                      navigate(`/dashboard/customer/appointments/reschedule/${appt.id}`, {
                        state: {
                          appointment: {
                            ...appt,
                            status: dynamic.status,
                            statusColor: dynamic.statusColor,
                            isLocked: dynamic.isLocked,
                            cancellationPolicy: dynamic.cancellationPolicy,
                          },
                        },
                      });
                    }}
                    onCancel={() => {
                      navigate(`/dashboard/customer/appointments/cancel/${appt.id}`, {
                        state: {
                          appointment: {
                            ...appt,
                            status: dynamic.status,
                            statusColor: dynamic.statusColor,
                            isLocked: dynamic.isLocked,
                            cancellationPolicy: dynamic.cancellationPolicy,
                          },
                        },
                      });
                    }}
                  />
                );
              })
            ) : (
              <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-8 text-center text-[#A1A1AA]">
                No past appointment history
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// Helper component for the Card to keep code clean
function AppointmentCard({ 
  id: _id,
  date, 
  time, 
  serviceType,
  address,
  location, 
  vehicle, 
  price, 
  packageName, 
  staffName, 
  staffStatus, 
  isMissed: propIsMissed, 
  isCancelled,
  completed,
  confirmed,
  hasMembership,
  rescheduledByOwner,
  previousSchedule,
  cancelReason,
  onReschedule, 
  onCancel 
}: any) {
  const dynamic = getDynamicAppointmentStatus(
    date,
    time,
    propIsMissed,
    completed,
    hasMembership,
    isCancelled ? 'Cancelled' : undefined,
    confirmed,
    staffStatus
  );

  const status = dynamic.status;
  const statusColor = dynamic.statusColor;
  const isLocked = dynamic.isLocked;
  const isMissed = dynamic.isMissed;
  const canReschedule = dynamic.canReschedule;
  const isRescheduleDisabled = isLocked || !canReschedule;
  const cancellationPolicy = dynamic.cancellationPolicy;
  const computedStaffStatus = isLocked && status === 'Staff on route' && (!staffStatus || staffStatus === 'Assigned' || staffStatus === 'Finding Staff...')
    ? 'On Route - 15 mins away'
    : staffStatus;
  
  const getBadgeStyles = (color: string) => {
    switch(color) {
      case 'burnt-orange': return 'bg-[#E86A33]/15 text-[#E86A33] border-[#E86A33]/30';
      case 'reward-green': return 'bg-[#35B86B]/15 text-[#35B86B] border-[#35B86B]/30';
      case 'red': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'blue': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'amber': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default: return 'bg-[#1F1F1F] text-[#A1A1AA] border-[#2C2C2C]';
    }
  };

  const displayAddress = address || location;

  return (
    <div className="bg-[#171717] border border-[#2C2C2C] rounded-xl p-5 flex flex-col md:flex-row gap-6 transition-colors hover:border-[#E86A33]/40 shadow-sm">
      
      {/* Column 1: Status & Time */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getBadgeStyles(statusColor)}`}>
            {status}
          </span>
          {serviceType && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1F1F1F] text-[#A1A1AA] border border-[#2C2C2C]">
              {serviceType}
            </span>
          )}
          {rescheduledByOwner && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E86A33]/15 text-[#E86A33] border border-[#E86A33]/30">
              Rescheduled by owner
            </span>
          )}
          {dynamic.isRefundEligible && status !== 'Cancelled' && status !== 'Completed' && status !== 'Missed' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#35B86B]/15 text-[#35B86B] border border-[#35B86B]/30">
              Refund Eligible
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex items-center gap-2 text-[#F5F5F5] font-medium">
            <Calendar className="w-4 h-4 text-[#E86A33]" />
            {date}
          </div>
          <div className="flex items-center gap-2 text-[#A1A1AA] text-sm">
            <Clock className="w-4 h-4 text-[#E86A33]" />
            {time}
          </div>
          {previousSchedule && (
            <div className="text-[11px] text-[#71717A] line-through pl-6">
              Was: {previousSchedule.date} at {previousSchedule.time}
            </div>
          )}
          {serviceType !== 'Drive-in' && displayAddress ? (
            <div className="flex items-center gap-2 text-[#A1A1AA] text-sm">
              <MapPin className="w-4 h-4 shrink-0 text-[#E86A33]" />
              <span className="truncate">{displayAddress}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Column 2: Vehicle & Package Inner Card */}
      <div className="flex-[1.5] flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-lg text-[#F5F5F5]">{vehicle}</h3>
          <span className="font-bold text-[#F5F5F5]">{price}</span>
        </div>
        
        <div className="bg-[#101010] border border-[#2C2C2C] rounded-lg p-3 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[#F5F5F5]">{packageName}</span>
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center overflow-hidden border ${
                confirmed
                  ? 'bg-[#35B86B]/15 border-[#35B86B]/30'
                  : 'bg-[#1F1F1F] border-[#2C2C2C]'
              }`}>
                {confirmed ? (
                  <UserCheck className="w-3 h-3 text-[#35B86B]" />
                ) : (
                  <User className="w-3 h-3 text-[#E86A33]" />
                )}
              </div>
              <span className="text-xs">
                {confirmed ? (
                  <span className="text-[#A1A1AA]">
                    Assigned Staff: <strong className="text-[#F5F5F5] font-semibold">{staffName}</strong>
                    {computedStaffStatus && <span className="text-[#71717A]"> ({computedStaffStatus})</span>}
                  </span>
                ) : (
                  <span className="text-[#A1A1AA]">
                    {staffName || 'Pending Assignment'} • {computedStaffStatus || 'Finding Staff...'}
                  </span>
                )}
              </span>
            </div>
          </div>
          <button className="text-[#71717A] hover:text-[#E86A33] transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {cancelReason && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
            <span className="font-semibold">Reason:</span> "{cancelReason}"
          </div>
        )}
      </div>

      {/* Column 3: Actions & Policy */}
      <div className="flex-1 flex flex-col justify-between gap-4 border-t md:border-t-0 md:border-l border-[#2C2C2C] pt-4 md:pt-0 md:pl-6">
        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          {cancellationPolicy || "Cancellation policies apply. Review our terms for details on refunds and fees."}
        </p>
        
        <div className="flex flex-col gap-2">
          {isMissed ? (
            <Button variant="outline" fullWidth className="!text-[#F5F5F5] !border-[#2C2C2C] hover:!border-[#E86A33] hover:!text-[#E86A33]">
              Request Refund
            </Button>
          ) : status === 'Completed' || status === 'Cancelled' ? (
            <Button variant="outline" fullWidth onClick={onReschedule} className="!text-[#F5F5F5] !border-[#2C2C2C] hover:!border-[#E86A33] hover:!text-[#E86A33]">
              Book Again
            </Button>
          ) : (
            <>
              <Button variant="outline" fullWidth disabled={isRescheduleDisabled} onClick={onReschedule} className="!text-[#F5F5F5] !border-[#2C2C2C] hover:!border-[#E86A33] hover:!text-[#E86A33] disabled:!border-[#2C2C2C] disabled:!text-[#71717A]">
                {isRescheduleDisabled && <Lock className="w-3.5 h-3.5" />}
                Reschedule
              </Button>
              <Button variant="outline" fullWidth disabled={isLocked} onClick={onCancel} className="!text-[#F5F5F5] !border-[#2C2C2C] hover:!border-[#E86A33] hover:!text-[#E86A33] disabled:!border-[#2C2C2C] disabled:!text-[#71717A]">
                {isLocked && <Lock className="w-3.5 h-3.5" />}
                Cancel Booking
              </Button>
            </>
          )}
        </div>
      </div>
      
    </div>
  );
}


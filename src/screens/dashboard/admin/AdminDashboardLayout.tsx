import { useState, useEffect, useRef } from "react";
import { Outlet, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wrench,
  CalendarDays,
  BarChart3,
  Star,
  LogOut,
  Menu,
  ShieldCheck,
  X,
  Bell,
  CalendarCheck,
  Clock,
  Crown,
  Gift,
  CheckCircle2,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useNotifications, type AppNotification } from "../../../contexts/NotificationsContext";
import { useAdminNotificationSync } from "../../../hooks/useAdminNotificationSync";
import ThemeToggle from "../../../components/ui/ThemeToggle";
import LogoutConfirmationModal from "../../../components/ui/LogoutConfirmationModal";

// ─── Dropdown Icon Renderer ───────────────────────────────────────────────────

function NotifPreviewIcon({
  type,
  color,
  bg,
}: {
  type: AppNotification["icon"];
  color: string;
  bg: string;
}) {
  const Icon =
    type === "calendar" ? CalendarCheck :
    type === "clock" ? Clock :
    type === "star" ? Star :
    type === "crown" ? Crown :
    type === "gift" ? Gift :
    CheckCircle2;

  return (
    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
  );
}

// ─── Notification Bell Dropdown (Screenshot 2 Match) ──────────────────────────

function AdminBellDropdown({
  onViewAll,
  onClose,
}: {
  onViewAll: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  // Show up to 5: unread first, then read
  const preview = [
    ...notifications.filter((n) => !n.isRead),
    ...notifications.filter((n) => n.isRead),
  ].slice(0, 5);

  const handleClickItem = (notif: AppNotification) => {
    if (!notif.isRead) markRead([notif.id]);
    onClose();
    if (notif.link) {
      navigate(notif.link);
    } else {
      navigate("/dashboard/admin/notifications");
    }
  };

  return (
    <div className="absolute right-0 top-[calc(100%+10px)] w-[340px] sm:w-[360px] bg-[#171717] border border-[#2C2C2C] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] z-50 overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2C2C]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#E86A33] text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="text-[11px] text-[#E86A33] font-medium hover:text-[#FF8055] transition-colors cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[340px] overflow-y-auto divide-y divide-[#232323]">
        {preview.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-[#222] border border-[#2C2C2C] flex items-center justify-center mb-2.5">
              <Bell className="w-4 h-4 text-[#71717A]" />
            </div>
            <p className="text-[13px] font-semibold text-[#F5F5F5] mb-1">No notifications yet</p>
            <p className="text-[11px] text-[#71717A] leading-relaxed">
              You're all caught up. Notifications about new bookings, cancellations, payments, and system activity will appear here.
            </p>
          </div>
        ) : (
          preview.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleClickItem(notif)}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left relative cursor-pointer ${
                !notif.isRead ? "bg-[#1E1E1E]" : ""
              }`}
            >
              {!notif.isRead && (
                <div className="absolute left-0 top-2 bottom-2 w-[2.5px] bg-[#E86A33] rounded-full" />
              )}
              <NotifPreviewIcon type={notif.icon} color={notif.iconColor} bg={notif.iconBg} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`text-[12px] font-semibold truncate ${
                      notif.isRead ? "text-[#E5E5E5]" : "text-white"
                    }`}
                  >
                    {notif.title}
                  </span>
                  {!notif.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E86A33] shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[#71717A] leading-relaxed line-clamp-2">
                  {notif.message}
                </p>
                <p className="text-[10px] text-[#52525B] mt-1">{notif.time}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#2C2C2C] bg-[#141414]">
        <button
          onClick={onViewAll}
          className="w-full text-center text-[12px] font-semibold text-[#E86A33] hover:text-[#FF8055] transition-colors py-1 cursor-pointer"
        >
          View all notifications →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useNotifications();

  // Role gate: only users whose profile has role "admin" may see this area.
  const [isAdmin, setIsAdmin] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  const uid = currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (cancelled) return;
        const role = snap.exists() ? snap.data().role || "customer" : "customer";
        if (role === "admin") {
          setIsAdmin(true);
        } else {
          setRedirectTo(`/dashboard/${role}`);
        }
      })
      .catch(() => {
        if (!cancelled) setRedirectTo("/auth/login");
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Real-time synchronization of admin events into notifications
  useAdminNotificationSync(isAdmin);

  // Mobile sidebar state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Bell dropdown state
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [bellOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setBellOpen(false);
  }, [location.pathname]);

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      navigate("/auth/login");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  if (!currentUser) return <Navigate to="/auth/login" replace />;
  if (redirectTo) return <Navigate to={redirectTo} replace />;
  if (!isAdmin) return <div className="min-h-screen bg-[#101010]" />;

  const displayName = currentUser.displayName || "Admin";
  const firstName = displayName.split(" ")[0] || "Admin";

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard/admin",
      icon: <LayoutDashboard className="w-4 h-4" />,
      exact: true,
    },
    {
      name: "Service Management",
      path: "/dashboard/admin/service-management",
      icon: <Wrench className="w-4 h-4" />,
    },
    {
      name: "Appointment",
      path: "/dashboard/admin/appointments",
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      name: "Business Analytics",
      path: "/dashboard/admin/business-analytics",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      name: "Reviews",
      path: "/dashboard/admin/reviews",
      icon: <Star className="w-4 h-4" />,
    },
    {
      name: "Notifications",
      path: "/dashboard/admin/notifications",
      icon: <Bell className="w-4 h-4" />,
    },
  ];

  return (
    <div className={theme}>
      <div className="min-h-screen bg-[#101010] font-sans flex text-[#F5F5F5] transition-colors duration-300 selection:bg-[#E86A33] selection:text-white relative">
        {/* Atmospheric Dark-Mode Effect */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              "radial-gradient(circle at 80% 0%, rgba(232,106,51,0.035), transparent 35%)",
          }}
        />

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Admin Sidebar */}
        <aside
          className={`w-[240px] bg-[#171717] border-r border-[#2C2C2C] fixed inset-y-0 left-0 flex flex-col z-40 transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Logo */}
          <div className="h-[64px] flex items-center justify-between px-6 border-b border-[#2C2C2C]">
            <Link to="/dashboard/admin" className="flex items-center group">
              <img
                src="/images/logo.png"
                alt="WashWizzy"
                className="w-24 h-auto object-contain"
              />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] lg:hidden cursor-pointer"
              aria-label="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3.5 px-[16px] py-[11px] min-h-[46px] rounded-lg transition-all font-medium text-[14px] ${
                    isActive
                      ? "bg-[rgba(232,106,51,0.10)] text-[#E86A33] border border-[#E86A33]/20 font-semibold"
                      : "text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#F5F5F5]"
                  }`}
                >
                  <div className="[&>svg]:w-[18px] [&>svg]:h-[18px]">
                    {item.icon}
                  </div>
                  <span className="flex-1">{item.name}</span>
                  {item.name === "Notifications" && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#E86A33] text-white text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Admin Account Section at the bottom */}
          <div className="p-4 border-t border-[#2C2C2C] mt-auto">
            <div className="flex items-center gap-3 px-[16px] py-[11px] min-h-[48px]">
              <div className="w-8 h-8 rounded-full bg-[#1F1F1F] border border-[#2C2C2C] shrink-0 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-[#E86A33]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate text-[#F5F5F5]">
                  {displayName}
                </p>
                <p className="text-[11px] truncate mt-0.5 text-[#A1A1AA]">
                  Admin Account
                </p>
              </div>
            </div>

            {/* Log Out Button */}
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className="mt-1.5 w-full flex items-center gap-3.5 px-[16px] py-[11px] min-h-[46px] rounded-lg transition-all font-medium text-[14px] text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#F5F5F5] cursor-pointer"
            >
              <div className="[&>svg]:w-[18px] [&>svg]:h-[18px]">
                <LogOut className="w-4 h-4" />
              </div>
              Log Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 lg:ml-[240px] flex flex-col min-h-screen relative z-10">
          {/* Top Bar */}
          <header className="h-[64px] bg-[#101010]/80 backdrop-blur-md shadow-md border-b border-[#2C2C2C] sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 -ml-2 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04] lg:hidden cursor-pointer"
                aria-label="Open Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <p className="text-[14px] text-[#A1A1AA] font-medium hidden sm:inline">
                  Welcome back,
                </p>
                <h1 className="text-[14px] font-semibold text-[#F5F5F5]">
                  {firstName}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Global Theme Toggle */}
              <ThemeToggle size={18} />

              <div className="h-5 w-px bg-[#2C2C2C]" />

              {/* Notification Bell Dropdown */}
              <div ref={bellRef} className="relative flex items-center justify-center">
                <button
                  onClick={() => setBellOpen((o) => !o)}
                  className="p-2 rounded-xl text-[#71717A] hover:text-[#F5F5F5] hover:bg-white/[0.06] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E86A33]/50 active:scale-95 relative flex items-center justify-center"
                  aria-label="Notifications"
                  title="Admin Notifications"
                >
                  <div className="relative w-5 h-5 flex items-center justify-center">
                    <Bell className="w-[18px] h-[18px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#E86A33] rounded-full ring-2 ring-[#101010]" />
                    )}
                  </div>
                </button>
                {bellOpen && (
                  <AdminBellDropdown
                    onClose={() => setBellOpen(false)}
                    onViewAll={() => {
                      setBellOpen(false);
                      navigate("/dashboard/admin/notifications");
                    }}
                  />
                )}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1400px] mx-auto">
              <Outlet context={{ theme }} />
            </div>
          </div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
      />
    </div>
  );
}

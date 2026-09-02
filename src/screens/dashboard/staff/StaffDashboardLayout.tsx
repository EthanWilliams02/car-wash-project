import { useState, useEffect, useRef } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Star,
  Settings,
  Bell,
  LogOut,
  CalendarCheck,
  Clock,
  CheckCircle2,
  Crown,
  Gift,
  Menu,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import ThemeToggle from "../../../components/ui/ThemeToggle";
import LogoutConfirmationModal from "../../../components/ui/LogoutConfirmationModal";
import { useNotifications, type AppNotification } from "../../../contexts/NotificationsContext";

// ─── Bell Dropdown ────────────────────────────────────────────────────────────

function NotifPreviewIcon({ type, color, bg }: { type: AppNotification["icon"]; color: string; bg: string }) {
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

function BellDropdown({ onClose }: { onClose: () => void }) {
  const { notifications, unreadCount, markRead } = useNotifications();
  // Show up to 5: unread first, then read
  const preview = [
    ...notifications.filter((n) => !n.isRead),
    ...notifications.filter((n) => n.isRead),
  ].slice(0, 5);

  return (
    <div className="absolute right-0 top-[calc(100%+10px)] w-[340px] sm:w-[360px] bg-[#171717] border border-[#2C2C2C] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden text-left">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2C2C]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#F5F5F5]">Staff Alerts</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#E86A33] text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markRead(notifications.filter((n) => !n.isRead).map((n) => n.id))}
            className="text-[11px] text-[#E86A33] font-medium hover:text-[#FF8055] transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[320px] overflow-y-auto divide-y divide-[#2C2C2C]/50">
        {preview.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Bell className="w-8 h-8 text-[#52525B] mb-2" />
            <p className="text-[12px] text-[#71717A]">No new notifications</p>
          </div>
        ) : (
          preview.map((notif) => (
            <button
              key={notif.id}
              onClick={() => {
                if (!notif.isRead) markRead([notif.id]);
              }}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left relative ${
                !notif.isRead ? "bg-[#1F1F1F]" : ""
              }`}
            >
              {!notif.isRead && (
                <div className="absolute left-0 top-2 bottom-2 w-[2.5px] bg-[#E86A33] rounded-full" />
              )}
              <NotifPreviewIcon type={notif.icon} color={notif.iconColor} bg={notif.iconBg} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[12px] font-semibold truncate ${notif.isRead ? "text-[#D8D5CF]" : "text-[#F5F5F5]"}`}>
                    {notif.title}
                  </span>
                  {!notif.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[#E86A33] shrink-0" />}
                </div>
                <p className="text-[11px] text-[#A1A1AA] leading-relaxed line-clamp-2">{notif.message}</p>
                <p className="text-[10px] text-[#71717A] mt-1">{notif.time}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#2C2C2C] bg-[#101010]/50">
        <button
          onClick={onClose}
          className="w-full text-center text-[12px] font-semibold text-[#A1A1AA] hover:text-[#F5F5F5] transition-colors py-1"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function StaffDashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useNotifications();

  // Mobile sidebar state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Bell dropdown state
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      const uid = currentUser?.uid;
      if (uid) {
        localStorage.removeItem(`ww_profile_name_${uid}`);
        localStorage.removeItem(`ww_profile_phone_${uid}`);
        localStorage.removeItem(`ww_profile_avatar_${uid}`);
      }
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const uid = currentUser?.uid;
  const displayName =
    currentUser?.displayName ||
    (uid ? localStorage.getItem(`ww_profile_name_${uid}`) : null) ||
    "Staff Member";
  const firstName = displayName.split(" ")[0] || "Staff";
  const photoURL =
    (uid ? localStorage.getItem(`ww_profile_avatar_${uid}`) : null) ||
    currentUser?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150";

  // Navigation Items required for Staff Sidebar
  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard/staff",
      icon: <LayoutDashboard className="w-4 h-4" />,
      exact: true,
    },
    {
      name: "My Appointments",
      path: "/dashboard/staff/appointments",
      icon: <CalendarDays className="w-4 h-4" />,
      exact: false,
    },
    {
      name: "My Reviews",
      path: "/dashboard/staff/reviews",
      icon: <Star className="w-4 h-4" />,
      exact: false,
    },
  ];

  const isProfileActive = location.pathname === "/dashboard/staff/profile";

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

        {/* Staff Sidebar */}
        <aside
          className={`w-[240px] bg-[#171717] border-r border-[#2C2C2C] fixed inset-y-0 left-0 flex flex-col z-40 transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Logo */}
          <div className="h-[64px] flex items-center justify-between px-6 border-b border-[#2C2C2C]">
            <Link to="/dashboard/staff" className="flex items-center group">
              <img
                src="/images/logo.png"
                alt="WashWizzy"
                className="w-24 h-auto object-contain"
              />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] lg:hidden"
              aria-label="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation items: exactly Dashboard, My Appointments, My Reviews */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3.5 px-[16px] py-[11px] min-h-[46px] rounded-lg transition-all font-medium text-[14px] ${
                    isActive
                      ? "bg-[rgba(232,106,51,0.10)] text-[#E86A33] border border-[#E86A33]/20 font-semibold"
                      : "text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#F5F5F5]"
                  }`}
                >
                  <div className="[&>svg]:w-[18px] [&>svg]:h-[18px]">
                    {item.icon}
                  </div>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Staff Profile Section at the bottom */}
          <div className="p-4 border-t border-[#2C2C2C] mt-auto">
            <Link
              to="/dashboard/staff/profile"
              className={`flex items-center gap-3 px-[16px] py-[11px] min-h-[48px] rounded-lg transition-colors cursor-pointer group ${
                isProfileActive
                  ? "bg-[rgba(232,106,51,0.10)] text-[#E86A33] border border-[#E86A33]/20"
                  : "hover:bg-white/[0.04]"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#1F1F1F] overflow-hidden shrink-0 border border-[#2C2C2C]">
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[13px] font-medium truncate ${
                    isProfileActive ? "text-[#E86A33]" : "text-[#F5F5F5]"
                  }`}
                >
                  {displayName}
                </p>
                <p
                  className={`text-[11px] truncate mt-0.5 ${
                    isProfileActive ? "text-[#E86A33]/80" : "text-[#A1A1AA]"
                  }`}
                >
                  Staff Account
                </p>
              </div>
              <Settings
                className={`w-4 h-4 transition-colors ${
                  isProfileActive
                    ? "text-[#E86A33]"
                    : "text-[#71717A] group-hover:text-[#A1A1AA]"
                }`}
              />
            </Link>

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
                className="p-2 -ml-2 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04] lg:hidden"
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

            {/* Top Navigation Right: Theme Toggle, Notifications, Profile (NO Upgrade button) */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                {/* Global Theme Toggle */}
                <ThemeToggle size={18} />

                {/* Notifications Bell Dropdown */}
                <div ref={bellRef} className="relative flex items-center justify-center">
                  <button
                    onClick={() => setBellOpen((o) => !o)}
                    className="p-2 rounded-xl text-[#71717A] hover:text-[#F5F5F5] hover:bg-white/[0.06] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E86A33]/50 active:scale-95 relative flex items-center justify-center"
                    aria-label="Notifications"
                    title="Staff Notifications"
                  >
                    <div className="relative w-5 h-5 flex items-center justify-center">
                      <Bell className="w-[18px] h-[18px]" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#E86A33] rounded-full ring-2 ring-[#101010]" />
                      )}
                    </div>
                  </button>
                  {bellOpen && <BellDropdown onClose={() => setBellOpen(false)} />}
                </div>

                {/* Staff Avatar */}
                <Link
                  to="/dashboard/staff/profile"
                  className="w-8 h-8 rounded-full bg-[#1F1F1F] overflow-hidden border border-[#2C2C2C] hover:border-[#E86A33] transition-colors shrink-0 flex items-center justify-center ml-1"
                  title="Staff Profile"
                >
                  <img
                    src={photoURL}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                </Link>
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

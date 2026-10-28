import { useState, useEffect } from "react";
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
} from "lucide-react";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import ThemeToggle from "../../../components/ui/ThemeToggle";
import LogoutConfirmationModal from "../../../components/ui/LogoutConfirmationModal";

export default function AdminDashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { theme } = useTheme();

  // Role gate: only users whose profile has role "admin" may see this area.
  // This is a UI-level check; Firestore rules are what actually protect data.
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

  // Mobile sidebar state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
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
              className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] lg:hidden"
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
                  {item.name}
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

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Global Theme Toggle */}
              <ThemeToggle size={18} />
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

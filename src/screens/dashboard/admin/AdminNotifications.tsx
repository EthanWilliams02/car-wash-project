import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarCheck,
  Clock,
  Star,
  Crown,
  Gift,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Check,
  Trash2,
  X,
  Settings,
  Smartphone,
  Mail,
  MessageSquare,
  Volume2,
  VolumeX,
  Moon,
  Zap,
  Shield,
  Tag,
} from "lucide-react";
import { useNotifications, type AppNotification } from "../../../contexts/NotificationsContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = "all" | AppNotification["category"];

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? "bg-[#E86A33]" : "bg-[#3A3A3A]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// ─── Icon Renderer ─────────────────────────────────────────────────────────────

function NotifIcon({ type, color, bg }: { type: AppNotification["icon"]; color: string; bg: string }) {
  const cls = `w-5 h-5 ${color}`;
  const Icon =
    type === "calendar" ? CalendarCheck :
    type === "clock" ? Clock :
    type === "star" ? Star :
    type === "crown" ? Crown :
    type === "gift" ? Gift :
    CheckCircle2;
  return (
    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
      <Icon className={cls} />
    </div>
  );
}

// ─── Preferences Settings type ────────────────────────────────────────────────

interface PreferencesSettings {
  appointments: boolean;
  rewards: boolean;
  promotions: boolean;
  systemUpdates: boolean;
  reviews: boolean;
  membership: boolean;
  pushNotifications: boolean;
  email: boolean;
  sms: boolean;
  quietHours: boolean;
  quietFrom: string;
  quietTo: string;
  frequency: "instant" | "hourly" | "daily";
  sound: boolean;
  vibration: boolean;
}

// ─── Preferences Modal ─────────────────────────────────────────────────────────

function PreferencesModal({
  open,
  onClose,
  prefs,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  prefs: PreferencesSettings;
  onChange: (key: keyof PreferencesSettings, value: boolean | string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const categoryRows: { key: keyof PreferencesSettings; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: "appointments", label: "Appointments", desc: "Customer bookings, reschedules, and cancellations", icon: <CalendarCheck className="w-4 h-4 text-[#E86A33]" /> },
    { key: "rewards", label: "Rewards & Points", desc: "Customer points redemptions and milestone achievements", icon: <Star className="w-4 h-4 text-[#35B86B]" /> },
    { key: "promotions", label: "Promotions", desc: "Campaign activations and voucher usages", icon: <Tag className="w-4 h-4 text-[#FBBF24]" /> },
    { key: "systemUpdates", label: "System Updates", desc: "Platform events, payment processing, and security notices", icon: <Shield className="w-4 h-4 text-[#A78BFA]" /> },
    { key: "reviews", label: "Reviews & Feedback", desc: "New customer reviews, ratings, and customer inquiries", icon: <Star className="w-4 h-4 text-[#E86A33]" /> },
    { key: "membership", label: "Membership", desc: "VIP membership subscriptions, renewals, and tier updates", icon: <Crown className="w-4 h-4 text-[#A78BFA]" /> },
  ];

  const deliveryRows: { key: keyof PreferencesSettings; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: "pushNotifications", label: "Push Notifications", desc: "In-browser and admin desktop push alerts", icon: <Smartphone className="w-4 h-4 text-[#E86A33]" /> },
    { key: "email", label: "Email", desc: "Sent to admin account email address", icon: <Mail className="w-4 h-4 text-[#E86A33]" /> },
    { key: "sms", label: "SMS / Text", desc: "Priority text alerts to administrator phone number", icon: <MessageSquare className="w-4 h-4 text-[#E86A33]" /> },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-[#161616] border-l border-[#2C2C2C] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2C2C2C] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E86A33]/10 border border-[#E86A33]/20 flex items-center justify-center">
              <Settings className="w-4 h-4 text-[#E86A33]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">Notification Preferences</h2>
              <p className="text-[11px] text-[#52525B] mt-0.5">Changes are saved automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#F5F5F5] hover:bg-white/[0.06] transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {/* Categories */}
          <section>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#52525B] mb-4">Notification Categories</p>
            <div className="space-y-2">
              {categoryRows.map(({ key, label, desc, icon }) => (
                <div key={key} className="flex items-center gap-4 p-4 bg-[#1C1C1C] border border-[#2C2C2C] rounded-xl hover:border-[#3A3A3A] transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-[#222] border border-[#2C2C2C] flex items-center justify-center shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#F5F5F5]">{label}</p>
                    <p className="text-[11px] text-[#52525B] mt-0.5 truncate">{desc}</p>
                  </div>
                  <Toggle checked={prefs[key] as boolean} onChange={() => onChange(key, !prefs[key])} />
                </div>
              ))}
            </div>
          </section>

          {/* Delivery */}
          <section>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#52525B] mb-4">Delivery Methods</p>
            <div className="space-y-2">
              {deliveryRows.map(({ key, label, desc, icon }) => (
                <div key={key} className="flex items-center gap-4 p-4 bg-[#1C1C1C] border border-[#2C2C2C] rounded-xl hover:border-[#3A3A3A] transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-[#E86A33]/10 border border-[#E86A33]/10 flex items-center justify-center shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#F5F5F5]">{label}</p>
                    <p className="text-[11px] text-[#52525B] mt-0.5">{desc}</p>
                  </div>
                  <Toggle checked={prefs[key] as boolean} onChange={() => onChange(key, !prefs[key])} />
                </div>
              ))}
            </div>
          </section>

          {/* Frequency */}
          <section>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#52525B] mb-4">Notification Frequency</p>
            <div className="flex gap-2">
              {(["instant", "hourly", "daily"] as const).map((freq) => {
                const labels = { instant: "Instant", hourly: "Hourly Digest", daily: "Daily Digest" };
                const icons = { instant: <Zap className="w-3.5 h-3.5" />, hourly: <Clock className="w-3.5 h-3.5" />, daily: <Bell className="w-3.5 h-3.5" /> };
                return (
                  <button key={freq} onClick={() => onChange("frequency", freq)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                      prefs.frequency === freq
                        ? "bg-[#E86A33]/10 border-[#E86A33]/40 text-[#E86A33]"
                        : "bg-[#1C1C1C] border-[#2C2C2C] text-[#71717A] hover:border-[#3A3A3A] hover:text-[#A1A1AA]"
                    }`}>
                    {icons[freq]}{labels[freq]}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Quiet Hours */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#52525B]">Quiet Hours</p>
                <p className="text-[11px] text-[#52525B] mt-1">Pause non-urgent alerts during these hours</p>
              </div>
              <Toggle checked={prefs.quietHours} onChange={() => onChange("quietHours", !prefs.quietHours)} />
            </div>
            {prefs.quietHours && (
              <div className="flex items-center gap-3 p-4 bg-[#1C1C1C] border border-[#2C2C2C] rounded-xl">
                <Moon className="w-4 h-4 text-[#A78BFA] shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1">
                    <label className="text-[10px] text-[#52525B] uppercase tracking-wide font-bold block mb-1">From</label>
                    <input type="time" value={prefs.quietFrom} onChange={(e) => onChange("quietFrom", e.target.value)}
                      className="w-full bg-[#222] border border-[#2C2C2C] rounded-lg px-3 py-1.5 text-[13px] text-[#F5F5F5] focus:outline-none focus:border-[#E86A33]/50" />
                  </div>
                  <span className="text-[#52525B] text-[12px] mt-4">—</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-[#52525B] uppercase tracking-wide font-bold block mb-1">To</label>
                    <input type="time" value={prefs.quietTo} onChange={(e) => onChange("quietTo", e.target.value)}
                      className="w-full bg-[#222] border border-[#2C2C2C] rounded-lg px-3 py-1.5 text-[13px] text-[#F5F5F5] focus:outline-none focus:border-[#E86A33]/50" />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Alert Style */}
          <section>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#52525B] mb-4">Alert Style</p>
            <div className="space-y-2">
              <div className="flex items-center gap-4 p-4 bg-[#1C1C1C] border border-[#2C2C2C] rounded-xl hover:border-[#3A3A3A] transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#1F1F1F] border border-[#2C2C2C] flex items-center justify-center shrink-0">
                  {prefs.sound ? <Volume2 className="w-4 h-4 text-[#A1A1AA]" /> : <VolumeX className="w-4 h-4 text-[#52525B]" />}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#F5F5F5]">Sound</p>
                  <p className="text-[11px] text-[#52525B] mt-0.5">Play a sound for new notifications</p>
                </div>
                <Toggle checked={prefs.sound} onChange={() => onChange("sound", !prefs.sound)} />
              </div>
              <div className="flex items-center gap-4 p-4 bg-[#1C1C1C] border border-[#2C2C2C] rounded-xl hover:border-[#3A3A3A] transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#1F1F1F] border border-[#2C2C2C] flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4 text-[#A1A1AA]" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#F5F5F5]">Vibration</p>
                  <p className="text-[11px] text-[#52525B] mt-0.5">Vibrate on mobile devices</p>
                </div>
                <Toggle checked={prefs.vibration} onChange={() => onChange("vibration", !prefs.vibration)} />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-[#2C2C2C] flex items-center justify-between bg-[#161616]">
          <p className="text-[11px] text-[#52525B] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#35B86B]" />
            All changes saved automatically
          </p>
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-[#E86A33] text-white text-[13px] font-semibold hover:bg-[#E86A33]/90 transition-colors cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Admin Notifications Page ─────────────────────────────────────────────

export default function AdminNotifications() {
  const navigate = useNavigate();

  const {
    notifications,
    clearedNotifications,
    unreadCount,
    clearedCount,
    settings,
    updateSetting,
    markRead,
    markAllRead,
    deleteNotifications,
    clearAll,
  } = useNotifications();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [clearedExpanded, setClearedExpanded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filtered = activeTab === "all"
    ? notifications
    : notifications.filter((n) => n.category === activeTab);

  // ─── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedCount = selectedIds.size;

  // ─── Actions (delegate to context) ──────────────────────────────────────────

  const handleMarkSelectedRead = () => {
    markRead([...selectedIds]);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    deleteNotifications([...selectedIds]);
    setSelectedIds(new Set());
  };

  const handleClearAll = () => {
    clearAll();
    setSelectedIds(new Set());
    setShowClearConfirm(false);
  };

  const handleDismissOne = (id: string) => {
    deleteNotifications([id]);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // ─── Tabs ────────────────────────────────────────────────────────────────────

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "appointments", label: "Appointments" },
    { key: "rewards", label: "Rewards" },
    { key: "promotions", label: "Promotions" },
    { key: "system", label: "System" },
    { key: "reviews", label: "Reviews" },
    { key: "membership", label: "Membership" },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards text-[#F5F5F5]">
        {/* Page Header */}
        <div className="mb-1">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-6 h-6 text-[#E86A33]" />
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#E86A33] text-white text-[11px] font-bold uppercase tracking-wide">
                {unreadCount} NEW
              </span>
            )}
          </div>
          <p className="text-sm text-[#71717A]">
            Stay up to date with bookings, cancellations, payments, and administrative system alerts.
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
          {/* ── Left: Notification list ── */}
          <div className="flex-1 min-w-0">
            {/* Tabs + actions */}
            <div className="flex flex-col gap-3 mb-4">
              {/* Actions row */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#71717A]">
                  Filter by category
                </span>
                <div className="flex items-center gap-4">
                  {showClearConfirm ? (
                    <div className="flex items-center gap-2 bg-[#1F1F1F] border border-[#3A3A3A] rounded-lg px-2.5 py-1">
                      <span className="text-[12px] text-[#A1A1AA]">Clear all?</span>
                      <button
                        onClick={handleClearAll}
                        className="text-[12px] text-[#E86A33] font-semibold hover:text-[#FF8055] transition-colors cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="text-[12px] text-[#71717A] hover:text-[#A1A1AA] transition-colors cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="text-[12px] text-[#71717A] hover:text-[#A1A1AA] transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1.5 text-[12px] text-[#E86A33] font-medium hover:text-[#FF8055] transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark all as read
                  </button>
                </div>
              </div>

              {/* Tabs container: wraps smoothly without scrollbar so all tabs are visible */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#171717] border border-[#2C2C2C] rounded-xl">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                      activeTab === tab.key
                        ? "bg-[#E86A33] text-white shadow-[0_0_12px_rgba(232,106,51,0.25)]"
                        : "text-[#71717A] hover:text-[#F5F5F5] hover:bg-white/[0.04]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk action bar */}
            {selectedCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-4 py-3 bg-[#171717] border border-[#2C2C2C] rounded-xl">
                <span className="text-[13px] text-[#A1A1AA]">
                  <span className="text-white font-semibold">{selectedCount}</span>{" "}
                  {selectedCount === 1 ? "notification" : "notifications"} selected
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleMarkSelectedRead}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-[#2C2C2C] text-[12px] font-bold uppercase tracking-wide text-[#A1A1AA] hover:text-[#F5F5F5] hover:border-[#3A3A3A] transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark as read
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E86A33]/10 border border-[#E86A33]/20 text-[12px] font-bold uppercase tracking-wide text-[#E86A33] hover:bg-[#E86A33]/20 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete selected
                  </button>
                </div>
              </div>
            )}

            {/* Cards */}
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 bg-[#171717] border border-[#2C2C2C] rounded-2xl text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#E86A33]/10 border border-[#E86A33]/20 flex items-center justify-center mb-3.5">
                    <Bell className="w-6 h-6 text-[#E86A33]" />
                  </div>
                  {activeTab === "all" ? (
                    <>
                      <h3 className="text-base font-semibold text-[#F5F5F5] mb-1.5">No notifications yet</h3>
                      <p className="text-xs sm:text-sm text-[#71717A] max-w-md leading-relaxed">
                        You're all caught up. Notifications about new bookings, cancellations, payments, and system activity will appear here.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-base font-semibold text-[#F5F5F5] mb-1.5">No {activeTab} notifications</h3>
                      <p className="text-xs sm:text-sm text-[#71717A] max-w-md leading-relaxed">
                        When you receive updates for {activeTab}, they will appear here.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                filtered.map((notif) => {
                  const isSelected = selectedIds.has(notif.id);
                  return (
                    <div
                      key={notif.id}
                      className={`relative flex items-start gap-4 px-4 py-4 rounded-2xl border transition-all duration-150 cursor-pointer group ${
                        notif.isRead
                          ? "bg-[#171717] border-[#2C2C2C] hover:border-[#3A3A3A]"
                          : "bg-[#1C1C1C] border-[#E86A33]/20 hover:border-[#E86A33]/40"
                      } ${isSelected ? "ring-1 ring-[#E86A33]/30" : ""}`}
                      onClick={() => toggleSelect(notif.id)}
                    >
                      {!notif.isRead && (
                        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-[#E86A33] rounded-full" />
                      )}
                      <div
                        className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-[#E86A33] border-[#E86A33]"
                            : "border-[#3A3A3A] bg-transparent group-hover:border-[#E86A33]/50"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(notif.id);
                        }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <NotifIcon type={notif.icon} color={notif.iconColor} bg={notif.iconBg} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[14px] font-semibold ${notif.isRead ? "text-[#E5E5E5]" : "text-white"}`}>
                              {notif.title}
                            </span>
                            {!notif.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[#E86A33] shrink-0" />}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissOne(notif.id);
                            }}
                            className="shrink-0 text-[#3A3A3A] hover:text-[#71717A] transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className={`text-[13px] leading-relaxed mt-1 ${notif.isRead ? "text-[#71717A]" : "text-[#A1A1AA]"}`}>
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-2.5">
                          <p className="text-[11px] text-[#52525B]">{notif.time}</p>
                          {notif.link && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!notif.isRead) markRead([notif.id]);
                                navigate(notif.link!);
                              }}
                              className="flex items-center gap-1 text-[11px] font-semibold text-[#E86A33] hover:text-[#FF8055] transition-colors cursor-pointer"
                            >
                              View details
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Recently Cleared */}
            <div className="mt-4">
              <button
                onClick={() => setClearedExpanded((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#171717] border border-[#2C2C2C] rounded-xl text-[13px] text-[#71717A] hover:text-[#A1A1AA] hover:border-[#3A3A3A] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#A1A1AA]">Recently Cleared</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#2C2C2C] text-[#71717A] font-semibold">
                    {clearedCount}
                  </span>
                </div>
                {clearedExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {clearedExpanded && (
                <div className="mt-2 p-4 bg-[#171717] border border-[#2C2C2C] rounded-xl">
                  {clearedNotifications.length === 0 ? (
                    <p className="text-[13px] text-[#52525B] text-center py-3">
                      No cleared notifications. Cleared notifications are stored for 30 days.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {clearedNotifications.slice(0, 10).map((cleared) => (
                        <div key={cleared.id} className="flex items-center justify-between py-2 border-b border-[#232323] last:border-0">
                          <div className="flex items-center gap-2 min-w-0 pr-3">
                            <span className="text-[13px] font-medium text-[#A1A1AA] truncate">{cleared.title}</span>
                          </div>
                          <span className="text-[11px] text-[#52525B] shrink-0">{cleared.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Settings panel ── */}
          <div className="xl:w-[300px] shrink-0">
            <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl p-5 sticky top-[80px]">
              <div className="flex items-center gap-2 mb-5">
                <Settings className="w-4 h-4 text-[#E86A33]" />
                <h2 className="text-[15px] font-semibold text-white">Notification Settings</h2>
              </div>
              <div className="space-y-3.5 mb-5">
                {[
                  { key: "appointments" as const, label: "Appointments" },
                  { key: "rewards" as const, label: "Rewards" },
                  { key: "promotions" as const, label: "Promotions" },
                  { key: "systemUpdates" as const, label: "System Updates" },
                  { key: "reviews" as const, label: "Reviews" },
                  { key: "membership" as const, label: "Membership" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[13px] text-[#A1A1AA]">{label}</span>
                    <Toggle checked={settings[key] as boolean} onChange={() => updateSetting(key, !settings[key])} />
                  </div>
                ))}
              </div>
              <div className="h-px bg-[#2C2C2C] mb-5" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#52525B] mb-3.5">Delivery Methods</p>
              <div className="space-y-3.5 mb-5">
                {[
                  { key: "pushNotifications" as const, label: "Push Notifications" },
                  { key: "email" as const, label: "Email" },
                  { key: "sms" as const, label: "SMS" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[13px] text-[#A1A1AA]">{label}</span>
                    <Toggle checked={settings[key] as boolean} onChange={() => updateSetting(key, !settings[key])} />
                  </div>
                ))}
              </div>
              <div className="h-px bg-[#2C2C2C] mb-4" />
              <button
                onClick={() => setPrefsOpen(true)}
                className="flex items-center gap-1 text-[13px] text-[#E86A33] font-medium hover:text-[#FF8055] transition-colors mb-2 group cursor-pointer"
              >
                Manage notification preferences
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <p className="text-[11px] text-[#52525B] leading-relaxed">Changes are saved automatically.</p>
            </div>
          </div>
        </div>
      </div>

      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} prefs={settings} onChange={updateSetting} />
    </>
  );
}

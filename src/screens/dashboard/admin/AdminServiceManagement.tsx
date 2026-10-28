import { useState, useEffect, useRef, useMemo, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  Clock,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
} from "lucide-react";

export type ServiceCategory = "Exterior" | "Interior" | "Full Detail";
export type ServiceStatus = "Active" | "Inactive";

export interface ServiceItem {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  duration: number; // in minutes
  status: ServiceStatus;
  createdAt: number;
}

const STORAGE_KEY = "ww_admin_services";
const ITEMS_PER_PAGE = 5;

const CATEGORIES = [
  "All Services",
  "Exterior",
  "Interior",
  "Full Detail",
] as const;

type FilterCategory = (typeof CATEGORIES)[number];

// Safe loader for persisted services
function loadStoredServices(): ServiceItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is ServiceItem => {
      return (
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        ["Exterior", "Interior", "Full Detail"].includes(item.category) &&
        typeof item.price === "number" &&
        !isNaN(item.price) &&
        item.price >= 0 &&
        typeof item.duration === "number" &&
        !isNaN(item.duration) &&
        item.duration > 0 &&
        ["Active", "Inactive"].includes(item.status)
      );
    });
  } catch (err) {
    console.error("Failed to load admin services from localStorage:", err);
    return [];
  }
}

function saveStoredServices(services: ServiceItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
  } catch (err) {
    console.error("Failed to save admin services to localStorage:", err);
  }
}

function formatRand(val: number): string {
  return `R${val.toFixed(2)}`;
}

export default function AdminServiceManagement() {
  const [services, setServices] = useState<ServiceItem[]>(() =>
    loadStoredServices()
  );
  const [selectedCategory, setSelectedCategory] =
    useState<FilterCategory>("All Services");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(
    null
  );
  const [deletingService, setDeletingService] = useState<ServiceItem | null>(
    null
  );

  // Sync to localStorage whenever services state changes
  useEffect(() => {
    saveStoredServices(services);
  }, [services]);

  // Combined filtering: Category & Search
  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory =
        selectedCategory === "All Services" ||
        service.category === selectedCategory;

      const matchesSearch =
        query === "" ||
        service.name.toLowerCase().includes(query) ||
        service.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [services, selectedCategory, searchQuery]);

  // Pagination calculations
  const totalCount = filteredServices.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Reset or adjust current page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedServices = filteredServices.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const displayStart = totalCount === 0 ? 0 : startIndex + 1;
  const displayEnd = totalCount === 0 ? 0 : Math.min(startIndex + ITEMS_PER_PAGE, totalCount);

  // Handlers for Add/Edit
  const handleOpenAddModal = () => {
    setEditingService(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditingService(null);
  };

  const handleSaveService = (data: {
    name: string;
    category: ServiceCategory;
    price: number;
    duration: number;
    status: ServiceStatus;
  }) => {
    if (editingService) {
      // Update existing
      setServices((prev) =>
        prev.map((s) =>
          s.id === editingService.id
            ? { ...s, ...data }
            : s
        )
      );
    } else {
      // Create new
      const newService: ServiceItem = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `srv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ...data,
        createdAt: Date.now(),
      };
      setServices((prev) => [newService, ...prev]);
      // Reset to page 1 to see newly added service
      setCurrentPage(1);
    }
    handleCloseFormModal();
  };

  // Handlers for Delete
  const handleOpenDeleteModal = (service: ServiceItem) => {
    setDeletingService(service);
  };

  const handleCloseDeleteModal = () => {
    setDeletingService(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingService) return;
    setServices((prev) => prev.filter((s) => s.id !== deletingService.id));
    handleCloseDeleteModal();
  };

  // Page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);

  return (
    <div className="w-full space-y-6">
      {/* ─── Page Heading ─── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#F5F5F5]">
          Service Management
        </h1>
        <p className="text-sm text-[#A1A1AA]">Manage all your services</p>
      </div>

      {/* ─── Horizontal Toolbar ─── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Category filter buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "bg-[#E86A33] text-white shadow-md shadow-[#E86A33]/25"
                    : "bg-[#171717] text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.05] border border-[#2C2C2C]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search Field & Add Service Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-64 lg:w-72">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search services"
              className="w-full pl-10 pr-4 py-2.5 bg-[#171717] border border-[#2C2C2C] rounded-xl text-sm text-[#F5F5F5] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#E86A33] hover:bg-[#cc5a2a] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#E86A33]/20 transition-all duration-200 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </div>

      {/* ─── Services Table ─── */}
      <div className="bg-[#171717] border border-[#2C2C2C] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2C2C2C] bg-[#171717] text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                <th scope="col" className="py-4 px-6">
                  Service
                </th>
                <th scope="col" className="py-4 px-6">
                  Category
                </th>
                <th scope="col" className="py-4 px-6">
                  Price
                </th>
                <th scope="col" className="py-4 px-6">
                  Status
                </th>
                <th scope="col" className="py-4 px-6 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C2C]">
              {paginatedServices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-[#A1A1AA]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-[#1F1F1F] border border-[#2C2C2C] flex items-center justify-center text-[#71717A] mb-1">
                        <PackageSearch className="w-6 h-6" />
                      </div>
                      <p className="text-base font-semibold text-[#F5F5F5]">
                        No services found
                      </p>
                      <p className="text-sm text-[#A1A1AA] max-w-sm">
                        {services.length === 0
                          ? "Get started by adding your first service to the catalog."
                          : "Try adjusting your category filter or search keywords."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedServices.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* 1. Service Name & Duration */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[15px] text-[#F5F5F5]">
                          {service.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] mt-1">
                          <Clock className="w-3.5 h-3.5 text-[#A1A1AA]" />
                          <span>{service.duration} min</span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Category */}
                    <td className="py-4 px-6">
                      <span className="text-sm text-[#D8D5CF]">
                        {service.category}
                      </span>
                    </td>

                    {/* 3. Price */}
                    <td className="py-4 px-6">
                      <span className="text-sm font-semibold text-[#F5F5F5]">
                        {formatRand(service.price)}
                      </span>
                    </td>

                    {/* 4. Status Badge */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          service.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/25"
                        }`}
                      >
                        {service.status}
                      </span>
                    </td>

                    {/* 5. Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(service)}
                          className="p-2 rounded-lg text-[#A1A1AA] hover:text-[#E86A33] hover:bg-white/[0.04] transition-colors cursor-pointer"
                          aria-label={`Edit ${service.name}`}
                          title="Edit service"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(service)}
                          className="p-2 rounded-lg text-[#A1A1AA] hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
                          aria-label={`Delete ${service.name}`}
                          title="Delete service"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Table Footer / Pagination ─── */}
        <div className="px-6 py-4 border-t border-[#2C2C2C] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#171717]">
          <div className="text-sm text-[#A1A1AA]">
            Showing <span className="font-semibold text-[#F5F5F5]">{displayStart}</span> to{" "}
            <span className="font-semibold text-[#F5F5F5]">{displayEnd}</span> of{" "}
            <span className="font-semibold text-[#F5F5F5]">{totalCount}</span> services
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || totalCount === 0}
              aria-label="Previous page"
              className="p-2 rounded-lg text-sm font-medium border border-[#2C2C2C] bg-[#171717] text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {pageNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCurrentPage(num)}
                aria-label={`Page ${num}`}
                aria-current={currentPage === num ? "page" : undefined}
                className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  currentPage === num
                    ? "bg-[#E86A33] text-white font-semibold shadow-sm"
                    : "border border-[#2C2C2C] bg-[#171717] text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04]"
                }`}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalCount === 0}
              aria-label="Next page"
              className="p-2 rounded-lg text-sm font-medium border border-[#2C2C2C] bg-[#171717] text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Add / Edit Service Modal (Portalled) ─── */}
      {isFormModalOpen && (
        <ServiceFormModal
          isOpen={isFormModalOpen}
          editingService={editingService}
          onClose={handleCloseFormModal}
          onSave={handleSaveService}
        />
      )}

      {/* ─── Delete Confirmation Dialog (Portalled) ─── */}
      {deletingService && (
        <DeleteConfirmModal
          service={deletingService}
          onClose={handleCloseDeleteModal}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit Service Modal Component
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceFormModalProps {
  isOpen: boolean;
  editingService: ServiceItem | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    category: ServiceCategory;
    price: number;
    duration: number;
    status: ServiceStatus;
  }) => void;
}

function ServiceFormModal({
  isOpen,
  editingService,
  onClose,
  onSave,
}: ServiceFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [name, setName] = useState(editingService?.name || "");
  const [category, setCategory] = useState<string>(
    editingService?.category || ""
  );
  const [price, setPrice] = useState<string>(
    editingService !== null ? String(editingService.price) : ""
  );
  const [duration, setDuration] = useState<string>(
    editingService !== null ? String(editingService.duration) : ""
  );
  const [status, setStatus] = useState<ServiceStatus>(
    editingService?.status || "Active"
  );

  const [errors, setErrors] = useState<{
    name?: string;
    category?: string;
    price?: string;
    duration?: string;
  }>({});

  // Focus trap & background scroll lock
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first input
    const timer = setTimeout(() => {
      const firstInput = modalRef.current?.querySelector<HTMLElement>(
        "input, select, button"
      );
      firstInput?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const newErrors: {
      name?: string;
      category?: string;
      price?: string;
      duration?: string;
    } = {};

    // 1. Service Name — required, not blank
    if (!name.trim()) {
      newErrors.name = "Service name is required.";
    }

    // 2. Category — required
    if (
      !category ||
      !["Exterior", "Interior", "Full Detail"].includes(category)
    ) {
      newErrors.category = "Please select a category.";
    }

    // 3. Price — zero or greater
    const priceNum = parseFloat(price);
    if (price.trim() === "" || isNaN(priceNum) || priceNum < 0) {
      newErrors.price = "Price must be zero or greater.";
    }

    // 4. Duration — positive whole number
    const durationNum = Number(duration);
    if (
      duration.trim() === "" ||
      isNaN(durationNum) ||
      !Number.isInteger(durationNum) ||
      durationNum <= 0
    ) {
      newErrors.duration = "Duration must be a positive whole number.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      category: category as ServiceCategory,
      price: priceNum,
      duration: durationNum,
      status,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        className="bg-[#171717] border border-[#2C2C2C] rounded-2xl w-full max-w-[420px] shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 text-[#F5F5F5]"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
          noValidate
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#2C2C2C]">
            <h2
              id="modal-heading"
              className="text-lg font-bold font-display text-[#F5F5F5]"
            >
              {editingService ? "Edit Service" : "Add Service"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.06] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4.5 overflow-y-auto flex-1">
            {/* Service Name */}
            <div>
              <label
                htmlFor="service-name-input"
                className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-1.5"
              >
                Service Name <span className="text-[#E86A33]">*</span>
              </label>
              <input
                id="service-name-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="e.g. Express Exterior Wash"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#101010] border ${
                  errors.name
                    ? "border-red-500 focus:ring-red-500/30"
                    : "border-[#2C2C2C] focus:border-[#E86A33] focus:ring-[#E86A33]/30"
                } text-sm text-[#F5F5F5] placeholder:text-[#71717A] outline-none focus:ring-2 transition-all`}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="service-category-select"
                className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-1.5"
              >
                Category <span className="text-[#E86A33]">*</span>
              </label>
              <select
                id="service-category-select"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (errors.category) {
                    setErrors((prev) => ({ ...prev, category: undefined }));
                  }
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#101010] border ${
                  errors.category
                    ? "border-red-500 focus:ring-red-500/30"
                    : "border-[#2C2C2C] focus:border-[#E86A33] focus:ring-[#E86A33]/30"
                } text-sm text-[#F5F5F5] outline-none focus:ring-2 transition-all cursor-pointer`}
              >
                <option value="" disabled>
                  Select category
                </option>
                <option value="Exterior">Exterior</option>
                <option value="Interior">Interior</option>
                <option value="Full Detail">Full Detail</option>
              </select>
              {errors.category && (
                <p className="mt-1 text-xs text-red-500">{errors.category}</p>
              )}
            </div>

            {/* Price (ZAR) */}
            <div>
              <label
                htmlFor="service-price-input"
                className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-1.5"
              >
                Price (ZAR) <span className="text-[#E86A33]">*</span>
              </label>
              <input
                id="service-price-input"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (errors.price) {
                    setErrors((prev) => ({ ...prev, price: undefined }));
                  }
                }}
                placeholder="e.g. 100.00"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#101010] border ${
                  errors.price
                    ? "border-red-500 focus:ring-red-500/30"
                    : "border-[#2C2C2C] focus:border-[#E86A33] focus:ring-[#E86A33]/30"
                } text-sm text-[#F5F5F5] placeholder:text-[#71717A] outline-none focus:ring-2 transition-all`}
              />
              {errors.price && (
                <p className="mt-1 text-xs text-red-500">{errors.price}</p>
              )}
            </div>

            {/* Duration (minutes) */}
            <div>
              <label
                htmlFor="service-duration-input"
                className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-1.5"
              >
                Duration (minutes) <span className="text-[#E86A33]">*</span>
              </label>
              <input
                id="service-duration-input"
                type="number"
                step="1"
                min="1"
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  if (errors.duration) {
                    setErrors((prev) => ({ ...prev, duration: undefined }));
                  }
                }}
                placeholder="e.g. 20"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#101010] border ${
                  errors.duration
                    ? "border-red-500 focus:ring-red-500/30"
                    : "border-[#2C2C2C] focus:border-[#E86A33] focus:ring-[#E86A33]/30"
                } text-sm text-[#F5F5F5] placeholder:text-[#71717A] outline-none focus:ring-2 transition-all`}
              />
              {errors.duration && (
                <p className="mt-1 text-xs text-red-500">{errors.duration}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label
                htmlFor="service-status-select"
                className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-1.5"
              >
                Status
              </label>
              <select
                id="service-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ServiceStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#101010] border border-[#2C2C2C] focus:border-[#E86A33] focus:ring-[#E86A33]/30 text-sm text-[#F5F5F5] outline-none focus:ring-2 transition-all cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2C2C2C] bg-[#171717]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#2C2C2C] text-sm font-semibold text-[#F5F5F5] hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#E86A33] hover:bg-[#cc5a2a] text-sm font-semibold text-white shadow-md shadow-[#E86A33]/25 transition-all cursor-pointer"
            >
              Save Service
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Confirmation Modal Component
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  service: ServiceItem;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({
  service,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap & background scroll lock
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => {
      const cancelBtn = modalRef.current?.querySelector<HTMLElement>("button");
      cancelBtn?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-desc"
        className="bg-[#171717] border border-[#2C2C2C] rounded-2xl w-full max-w-[400px] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-[#F5F5F5]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            id="delete-modal-title"
            className="text-lg font-bold font-display text-[#F5F5F5]"
          >
            Delete Service
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p
          id="delete-modal-desc"
          className="text-sm text-[#A1A1AA] leading-relaxed mb-6"
        >
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[#F5F5F5]">{service.name}</span>?
          This action cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#2C2C2C] text-sm font-semibold text-[#F5F5F5] hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white shadow-md shadow-red-600/20 transition-all cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useEffect } from "react";
import { collectionGroup, onSnapshot, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useNotifications } from "../contexts/NotificationsContext";

/**
 * Real-time hook for administrators to automatically capture administrative events
 * (such as newly booked customer appointments, cancellations, confirmations, and reviews)
 * and generate persistent, deduplicated admin notifications.
 */
export function useAdminNotificationSync(isAdmin: boolean) {
  const { addNotification, clearedNotifications, allNotifications } = useNotifications();

  useEffect(() => {
    if (!isAdmin) return;

    // Set of all known event IDs (both active and cleared) to avoid duplicate creation
    const knownEventIds = new Set<string>();
    allNotifications.forEach((n) => {
      if (n.eventId) knownEventIds.add(n.eventId);
    });
    clearedNotifications.forEach((n) => {
      if (n.eventId) knownEventIds.add(n.eventId);
    });

    // 1. Subscribe to appointments across all customers via collectionGroup
    const apptsQuery = query(collectionGroup(db, "appointments"));

    const unsubAppts = onSnapshot(
      apptsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          // Listen to new additions or status modifications
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            const id = change.doc.id;
            const customerName = data.customerName || data.name || "A customer";
            const packageName = data.packageName || data.serviceName || "Car Wash Service";
            const dateStr = data.date || "Scheduled date";
            const timeStr = data.time || "Scheduled time";

            // Event A: Awaiting Confirmation
            if (data.status === "Awaiting Confirmation") {
              const eventId = `admin-booking-${id}`;
              if (!knownEventIds.has(eventId)) {
                knownEventIds.add(eventId);
                addNotification({
                  category: "appointments",
                  icon: "calendar",
                  iconColor: "text-[#E86A33]",
                  iconBg: "bg-[#E86A33]/10",
                  title: `New Booking: ${packageName}`,
                  message: `${customerName} booked an appointment for ${dateStr} at ${timeStr}.`,
                  link: "/dashboard/admin/appointments",
                  eventId,
                });
              }
            }

            // Event B: Cancelled
            if (data.status === "Cancelled") {
              const eventId = `admin-cancel-${id}`;
              if (!knownEventIds.has(eventId)) {
                knownEventIds.add(eventId);
                const reasonText = data.cancelReason ? ` Reason: ${data.cancelReason}` : "";
                addNotification({
                  category: "appointments",
                  icon: "clock",
                  iconColor: "text-[#E86A33]",
                  iconBg: "bg-[#E86A33]/10",
                  title: "Appointment Cancelled",
                  message: `Booking #${id.slice(0, 8)} for ${customerName} was cancelled.${reasonText}`,
                  link: "/dashboard/admin/appointments",
                  eventId,
                });
              }
            }

            // Event C: Confirmed & Assigned
            if (data.status === "Confirmed" && data.confirmed) {
              const eventId = `admin-confirmed-${id}`;
              if (!knownEventIds.has(eventId)) {
                knownEventIds.add(eventId);
                const staffPart = data.staffName ? ` assigned to ${data.staffName}` : "";
                addNotification({
                  category: "appointments",
                  icon: "check",
                  iconColor: "text-[#35B86B]",
                  iconBg: "bg-[#35B86B]/10",
                  title: "Appointment Confirmed",
                  message: `Booking for ${customerName} on ${dateStr}${staffPart} has been confirmed.`,
                  link: "/dashboard/admin/appointments",
                  eventId,
                });
              }
            }

            // Event D: Completed
            if (data.completed || data.status === "Completed") {
              const eventId = `admin-completed-${id}`;
              if (!knownEventIds.has(eventId)) {
                knownEventIds.add(eventId);
                addNotification({
                  category: "system",
                  icon: "check",
                  iconColor: "text-[#35B86B]",
                  iconBg: "bg-[#35B86B]/10",
                  title: "Service Completed",
                  message: `Service for ${customerName} (${packageName}) has been completed.`,
                  link: "/dashboard/admin/appointments",
                  eventId,
                });
              }
            }
          }
        });
      },
      (err) => {
        console.warn("Admin appointment sync listener note:", err.message);
      }
    );

    // 2. Subscribe to reviews collection across all customers if any exist
    const reviewsQuery = query(collectionGroup(db, "reviews"));
    const unsubReviews = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const id = change.doc.id;
            const eventId = `admin-review-${id}`;
            if (!knownEventIds.has(eventId)) {
              knownEventIds.add(eventId);
              const author = data.customerName || data.userName || "Customer";
              const rating = data.rating || 5;
              addNotification({
                category: "reviews",
                icon: "star",
                iconColor: "text-[#E86A33]",
                iconBg: "bg-[#E86A33]/10",
                title: "New Customer Review",
                message: `${author} left a ${rating}-star review for WashWizzy services.`,
                link: "/dashboard/admin/reviews",
                eventId,
              });
            }
          }
        });
      },
      (err) => {
        // Reviews collection group may not exist or rule not configured; safe note
        console.debug("Reviews listener note:", err.message);
      }
    );

    return () => {
      unsubAppts();
      unsubReviews();
    };
  }, [isAdmin, addNotification, allNotifications, clearedNotifications]);
}

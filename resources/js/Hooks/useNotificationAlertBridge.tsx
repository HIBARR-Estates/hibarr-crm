import { useCallback, type ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { useNotificationSummary } from "@/Hooks/useNotifications";
import type { Notification } from "@/Types/api/notification";
import { useNotificationAlert } from "@/Components/NotificationAlertProvider";
import { isAlertsMuted } from "@/lib/notificationAlerts";
import { mapNotificationToAlert } from "@/lib/mapNotificationToAlert";

const POLL_MS = 30_000;

/**
 * Polls unread notifications app-wide and feeds the floating island alert.
 * Mount once inside NotificationAlertProvider for authenticated users.
 */
export function useNotificationAlertBridge(): void {
    const { push } = useNotificationAlert();

    const onNewNotifications = useCallback(
        (newOnes: Notification[]) => {
            if (isAlertsMuted()) return;
            const latest = newOnes[0];
            if (!latest) return;
            push(mapNotificationToAlert(latest));
        },
        [push],
    );

    useNotificationSummary(POLL_MS, true, onNewNotifications);
}

/** Skips guest pages — no notification feed before login. */
export function NotificationAlertBridgeMount(): ReactNode {
    const { props } = usePage<PageProps>();
    if (!props.auth?.user) return null;
    return <AuthenticatedNotificationAlertBridge />;
}

function AuthenticatedNotificationAlertBridge(): null {
    useNotificationAlertBridge();
    return null;
}

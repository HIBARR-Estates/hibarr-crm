import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { NOTIFICATION_ISLAND_ALERTS_FLAG } from "@/lib/notificationIslandAlertsFlag";
import { REALTIME_NOTIFICATIONS_FLAG } from "@/lib/realtimeNotificationsFlag";

/**
 * Whether notifications are delivered over the WebSocket instead of polled.
 *
 * All of these must hold, otherwise the browser quietly keeps polling:
 *  - crm.realtime-notifications is on,
 *  - crm.notification-island-alerts is on (the popup provider the stream feeds),
 *  - the server shipped a `realtime` connection config (the server side is enabled
 *    and fully configured),
 *  - someone is signed in.
 */
export default function useRealtimeNotificationsEnabled(): boolean {
    const { props } = usePage<PageProps>();
    const flags = props.featureFlags;

    return (
        flags?.[REALTIME_NOTIFICATIONS_FLAG] === true &&
        flags?.[NOTIFICATION_ISLAND_ALERTS_FLAG] === true &&
        !!props.realtime &&
        !!props.auth?.user
    );
}

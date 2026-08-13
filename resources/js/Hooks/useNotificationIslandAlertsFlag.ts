import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { NOTIFICATION_ISLAND_ALERTS_FLAG } from "@/lib/notificationIslandAlertsFlag";

export default function useNotificationIslandAlertsFlag(): boolean {
    const { props } = usePage<PageProps>();

    return props.featureFlags?.[NOTIFICATION_ISLAND_ALERTS_FLAG] === true;
}

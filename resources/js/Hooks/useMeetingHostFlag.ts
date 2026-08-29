import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { MEETING_HOST_FLAG } from "@/lib/meetingHostFlag";

export default function useMeetingHostFlag(): boolean {
    const { props } = usePage<PageProps>();

    return props.featureFlags?.[MEETING_HOST_FLAG] === true;
}

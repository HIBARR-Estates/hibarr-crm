import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { MEETING_ATTENDANCE_CONFIRMATION_FLAG } from "@/lib/meetingAttendanceConfirmationFlag";

export default function useMeetingAttendanceConfirmationFlag(): boolean {
    const { props } = usePage<PageProps>();

    return props.featureFlags?.[MEETING_ATTENDANCE_CONFIRMATION_FLAG] === true;
}

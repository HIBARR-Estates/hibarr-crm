import type { ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import useMeetingAttendanceConfirmationFlag from "@/Hooks/useMeetingAttendanceConfirmationFlag";
import { MeetingAttendanceConfirmationDock } from "./Dock/MeetingAttendanceConfirmationDock";

/** Skips guest pages and companies the flag isn't enabled for — no polling before login. */
export function MeetingAttendanceConfirmationMount(): ReactNode {
    const { props } = usePage<PageProps>();
    const flagEnabled = useMeetingAttendanceConfirmationFlag();

    if (!props.auth?.user || !flagEnabled) return null;

    return <MeetingAttendanceConfirmationDock />;
}

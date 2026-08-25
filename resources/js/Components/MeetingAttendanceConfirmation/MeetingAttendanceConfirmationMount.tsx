import type { ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import useMeetingAttendanceConfirmationFlag from "@/Hooks/useMeetingAttendanceConfirmationFlag";
import { useMeetingAttendanceConfirmation } from "@/Hooks/useMeetingAttendanceConfirmation";
import MeetingAttendanceConfirmationModal from "./MeetingAttendanceConfirmationModal";

/** Skips guest pages and companies the flag isn't enabled for — no polling before login. */
export function MeetingAttendanceConfirmationMount(): ReactNode {
    const { props } = usePage<PageProps>();
    const flagEnabled = useMeetingAttendanceConfirmationFlag();

    if (!props.auth?.user || !flagEnabled) return null;

    return <AuthenticatedMeetingAttendanceConfirmation />;
}

function AuthenticatedMeetingAttendanceConfirmation(): ReactNode {
    const { current, dismiss, resolve } = useMeetingAttendanceConfirmation(true);

    if (!current) return null;

    return (
        <MeetingAttendanceConfirmationModal
            meeting={current}
            onDismiss={() => dismiss(current.id)}
            onConfirmed={() => {
                dismiss(current.id);
                resolve();
            }}
        />
    );
}

import { useState } from "react";
import { useMeetingAttendanceConfirmations } from "@/Hooks/useMeetingAttendanceConfirmations";
import MeetingAttendanceConfirmationModal from "../MeetingAttendanceConfirmationModal";
import AttendanceLauncherTab from "./AttendanceLauncherTab";
import AttendancePanel from "./AttendancePanel";

/**
 * Non-interruptive dock for the meeting-attendance-confirmation feature:
 * starts minimized (just the launcher tab), expands into a paged
 * one-at-a-time panel, and opens the existing full-detail modal for
 * "Open". Confirming in the modal resolves the card; the panel's Snooze
 * button hides it for an hour, with an Undo action on the resulting
 * in-app notification.
 */
export function MeetingAttendanceConfirmationDock() {
    const { items, remove, snoozeLocally, restore } =
        useMeetingAttendanceConfirmations(true);
    const [open, setOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [openModalId, setOpenModalId] = useState<number | null>(null);

    const modalItem = openModalId ? items.find((i) => i.id === openModalId) : undefined;

    return (
        <>
            {!open && items.length > 0 && (
                <AttendanceLauncherTab count={items.length} onOpen={() => setOpen(true)} />
            )}

            {open && (
                <AttendancePanel
                    items={items}
                    page={page}
                    onPageChange={setPage}
                    onMinimize={() => setOpen(false)}
                    onOpen={(id) => setOpenModalId(id)}
                    onSnoozed={snoozeLocally}
                    onRestore={restore}
                />
            )}

            {modalItem && (
                <MeetingAttendanceConfirmationModal
                    meeting={modalItem}
                    onDismiss={() => setOpenModalId(null)}
                    onConfirmed={() => {
                        remove(modalItem.id);
                        setOpenModalId(null);
                    }}
                />
            )}
        </>
    );
}

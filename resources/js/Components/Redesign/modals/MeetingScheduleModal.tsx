import useMeetingsPageRedesignFlag from "@/Hooks/useMeetingsPageRedesignFlag";
import ScheduleMeetingDrawer from "@/Features/Meetings/ScheduleMeetingDrawer";
import OrphanScheduleMeetingDialog from "@/Components/Redesign/modals/OrphanScheduleMeetingDialog";
import useMeetingTypesForSchedule from "@/Components/Redesign/meeting/useMeetingTypesForSchedule";

export interface MeetingScheduleModalProps {
    open: boolean;
    onClose: () => void;
    userDeals: Array<{ id: number; name: string }>;
    userLeads?: Array<{ id: number; name: string }>;
    /**
     * Optional — Meetings index already has them in page props. Dashboard and
     * other orphan surfaces omit this and types are fetched when the redesign
     * dialog opens.
     */
    meetingTypes?: Array<{ id: number; name: string; color?: string }>;
    /** Called after a successful create (list reload, close parent state, etc.). */
    onSuccess?: () => void;
    /** Calendar slot click — redesign dialog only. */
    initialStart?: { date: string; startTime: string };
}

/**
 * The app's only orphan/global schedule-meeting entry when
 * `crm.meetings-page-redesign` is on.
 *
 * Renders the Meetings-page stepped dialog (pick deal/lead, then form). When
 * the flag is off, renders ScheduleMeetingDrawer unchanged. Deal/Lead
 * workspace create stays on their bound schedule modals — they already know
 * the record.
 */
export default function MeetingScheduleModal({
    open,
    onClose,
    userDeals,
    userLeads = [],
    meetingTypes: meetingTypesProp,
    onSuccess,
    initialStart,
}: MeetingScheduleModalProps) {
    const redesign = useMeetingsPageRedesignFlag();
    const meetingTypes = useMeetingTypesForSchedule(
        meetingTypesProp,
        redesign && open,
    );

    const handleScheduled = () => {
        onSuccess?.();
    };

    if (!redesign) {
        return (
            <ScheduleMeetingDrawer
                open={open}
                onClose={onClose}
                userDeals={userDeals}
                userLeads={userLeads}
                onSuccess={onSuccess}
            />
        );
    }

    return (
        <OrphanScheduleMeetingDialog
            open={open}
            onClose={onClose}
            onScheduled={handleScheduled}
            userDeals={userDeals}
            userLeads={userLeads}
            meetingTypes={meetingTypes}
            initialStart={initialStart}
        />
    );
}

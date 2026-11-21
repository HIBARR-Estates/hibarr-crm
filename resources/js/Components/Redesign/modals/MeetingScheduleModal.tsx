import useMeetingsPageRedesignFlag from "@/Hooks/useMeetingsPageRedesignFlag";
import ScheduleMeetingDrawer from "@/Features/Meetings/ScheduleMeetingDrawer";
import OrphanScheduleMeetingDialog from "@/Components/Redesign/modals/OrphanScheduleMeetingDialog";
import OrphanScheduleMeetingDialogLegacy from "@/Components/Redesign/modals/OrphanScheduleMeetingDialogLegacy";
import useMeetingsImprovementsFlag from "@/Hooks/useMeetingsImprovementsFlag";
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
    /** Opens on this record instead of asking for one; redesign dialog only. */
    initialRecord?: { type: "deal" | "lead"; id: number };
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
    initialRecord,
}: MeetingScheduleModalProps) {
    const redesign = useMeetingsPageRedesignFlag();
    const improved = useMeetingsImprovementsFlag();
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

    // Without `crm.meetings-page-improvements`: the Deal/Lead picker dialog it
    // always was, fed by the lists the page sends.
    if (!improved) {
        return (
            <OrphanScheduleMeetingDialogLegacy
                open={open}
                onClose={onClose}
                onScheduled={handleScheduled}
                userDeals={userDeals}
                userLeads={userLeads}
                meetingTypes={meetingTypes}
                initialStart={initialStart}
                initialRecord={initialRecord}
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
            initialRecord={initialRecord}
        />
    );
}

/**
 * @deprecated Prefer `MeetingScheduleModal` for orphan/global create so the
 * meetings-page redesign flag is applied. This re-exports the shared dialog
 * body for any direct Meetings-page imports that remain.
 */
export {
    default,
    type OrphanScheduleMeetingDialogProps as MeetingsScheduleDialogProps,
} from "@/Components/Redesign/modals/OrphanScheduleMeetingDialog";

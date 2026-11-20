import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import BulkActionBar from "@/Components/Redesign/primitives/BulkActionBar";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useMeetingsBulkActions, {
    type MeetingBulkChange,
    type MeetingBulkStatus,
} from "../hooks/useMeetingsBulkActions";
import useMeetingUiLabel from "@/Components/Redesign/meeting/useMeetingUiLabel";

interface MeetingsBulkBarProps {
    selectedIds: number[];
    clearSelection: () => void;
    /** Paints a confirmed change into the list ahead of the reload. */
    onApplied?: (change: MeetingBulkChange) => void;
    onChanged: () => void;
    canEdit: boolean;
    canDelete: boolean;
}

const STATUS_OPTIONS: Array<{ value: MeetingBulkStatus; label: string }> = [
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
];

/**
 * The bulk bar for selected meetings — the shared `BulkActionBar`, with the
 * two actions the follow-up bulk endpoint supports.
 */
export default function MeetingsBulkBar({
    selectedIds,
    clearSelection,
    onApplied,
    onChanged,
    canEdit,
    canDelete,
}: MeetingsBulkBarProps) {
    const { td } = useTd();
    const ui = useMeetingUiLabel();
    const { t } = useTranslation();
    const {
        isApplying,
        confirmDelete,
        openConfirmDelete,
        closeConfirmDelete,
        deleteSelected,
        setStatus,
    } = useMeetingsBulkActions({
        selectedIds,
        clearSelection,
        onApplied,
        onChanged,
    });

    if (selectedIds.length === 0) return null;

    return (
        <>
            <BulkActionBar
                count={selectedIds.length}
                onClear={clearSelection}
                clearLabel={t("pages.meetings.ui.clear_selection")}
                selectedLabel={`${selectedIds.length} ${selectedIds.length === 1 ? t("pages.meetings.ui.meeting_selected") : t("pages.meetings.ui.meetings_selected")}`}
            >
                {canEdit && (
                    <MenuSelect
                        value={null}
                        onChange={(value) =>
                            setStatus(value as MeetingBulkStatus)
                        }
                        options={STATUS_OPTIONS.map((option) => ({
                            value: option.value,
                            label: ui(option.label),
                        }))}
                        placeholder={t("pages.meetings.ui.set_status")}
                        disabled={isApplying}
                    />
                )}
                {canDelete && (
                    <button
                        type="button"
                        className="dr-btn"
                        onClick={openConfirmDelete}
                        disabled={isApplying}
                        style={{
                            background: "transparent",
                            border: `1px solid rgba(255,255,255,0.35)`,
                            color: T.WHITE,
                        }}
                    >
                        {t("pages.meetings.ui.delete")}
                    </button>
                )}
            </BulkActionBar>

            <ConfirmDialog
                open={confirmDelete}
                title={t("pages.meetings.ui.delete_selected_meetings")}
                message={t("pages.meetings.ui.the_meetings_and_their_reminders_are_removed")}
                confirmLabel={t("pages.meetings.ui.delete")}
                danger
                confirmLoading={isApplying}
                onConfirm={deleteSelected}
                onCancel={closeConfirmDelete}
            />
        </>
    );
}

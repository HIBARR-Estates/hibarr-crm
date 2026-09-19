import { useTd } from "@/Hooks/useDynamicTranslation";
import BulkActionBar from "@/Components/Redesign/primitives/BulkActionBar";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useMeetingsBulkActions, {
    type MeetingBulkStatus,
} from "../hooks/useMeetingsBulkActions";

interface MeetingsBulkBarProps {
    selectedIds: number[];
    clearSelection: () => void;
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
    onChanged,
    canEdit,
    canDelete,
}: MeetingsBulkBarProps) {
    const { td } = useTd();
    const {
        isApplying,
        confirmDelete,
        openConfirmDelete,
        closeConfirmDelete,
        deleteSelected,
        setStatus,
    } = useMeetingsBulkActions({ selectedIds, clearSelection, onChanged });

    if (selectedIds.length === 0) return null;

    return (
        <>
            <BulkActionBar
                count={selectedIds.length}
                onClear={clearSelection}
                clearLabel={td("Clear selection")}
                selectedLabel={`${selectedIds.length} ${td(
                    selectedIds.length === 1
                        ? "meeting selected"
                        : "meetings selected",
                )}`}
            >
                {canEdit && (
                    <MenuSelect
                        value={null}
                        onChange={(value) =>
                            setStatus(value as MeetingBulkStatus)
                        }
                        options={STATUS_OPTIONS.map((option) => ({
                            value: option.value,
                            label: td(option.label),
                        }))}
                        placeholder={td("Set status")}
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
                        {td("Delete")}
                    </button>
                )}
            </BulkActionBar>

            <ConfirmDialog
                open={confirmDelete}
                title={td("Delete selected meetings?")}
                message={td(
                    "The meetings and their reminders are removed. This cannot be undone.",
                )}
                confirmLabel={td("Delete")}
                danger
                confirmLoading={isApplying}
                onConfirm={deleteSelected}
                onCancel={closeConfirmDelete}
            />
        </>
    );
}

import { Modal } from "@/Components/Redesign/primitives/Modal";
import RedesignButton from "@/Components/Redesign/primitives/Button";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { fmt } from "@/Features/Filters/controls";
import { ChangeChips } from "./BulkActionSummary";

interface Props {
    open: boolean;
    /** Rows the action will touch. */
    count: number;
    /** Plural noun, e.g. "leads" / "deals". */
    entityLabel: string;
    /** Per-field descriptions, e.g. "Categories → VIP". */
    changes: string[];
    /**
     * Caveats worth reading before confirming — what will be skipped, what is
     * irreversible, and whether this reaches rows that are not on screen.
     */
    notes?: string[];
    confirmLabel: string;
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Pre-action review step. Bulk edits reach rows the operator cannot see on
 * screen, so the last thing before committing is a plain-language read-back of
 * exactly what is about to change.
 */
export default function BulkActionConfirm({
    open,
    count,
    entityLabel,
    changes,
    notes = [],
    confirmLabel,
    loading = false,
    onConfirm,
    onCancel,
}: Props) {
    return (
        <Modal
            open={open}
            onClose={onCancel}
            title="Confirm bulk action"
            maxWidth={520}
            // Opened from inside the antd bulk-update modal. That modal sits at
            // 1400: the app raises antd's zIndexPopupBase to 1300 (see
            // providers/antd/utils.ts) and antd adds its own +100 Modal offset.
            // 1450 clears it while staying under the 1500 floating menus.
            zIndex={1450}
            footer={
                <>
                    <RedesignButton
                        variant="ghost"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </RedesignButton>
                    <RedesignButton
                        variant="primary"
                        loading={loading}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </RedesignButton>
                </>
            }
        >
            <p className="text-sm" style={{ color: T.TEXT }}>
                This will change{" "}
                <strong>
                    {fmt(count)} {entityLabel}
                </strong>
                :
            </p>

            <div className="my-3">
                <ChangeChips changes={changes} background={T.SURFACE_2} />
            </div>

            {notes.length > 0 && (
                <ul
                    className="m-0 list-disc space-y-1 pl-5 text-xs"
                    style={{ color: T.TEXT_MUTED }}
                >
                    {notes.map((note) => (
                        <li key={note}>{note}</li>
                    ))}
                </ul>
            )}
        </Modal>
    );
}

import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { fmt } from "@/Features/Filters/controls";

/** What a finished bulk action reports back to the list view. */
export interface BulkActionSummaryData {
    /** Headline verb, e.g. "updated" / "deleted". */
    verb: string;
    /** Plural noun, e.g. "leads" / "deals". */
    entityLabel: string;
    /** Rows the action actually touched. */
    count: number;
    /** Per-field descriptions, e.g. "Categories → VIP". */
    changes?: string[];
    /** Rows left untouched, with the reason shown next to the count. */
    skipped?: Array<{ count: number; reason: string }>;
}

interface Props {
    summary: BulkActionSummaryData;
    onDismiss: () => void;
}

/**
 * The per-field change list, shared by the pre-action confirmation and the
 * post-action receipt so both describe a change in exactly the same words.
 */
export function ChangeChips({
    changes,
    background = T.WHITE,
}: {
    changes: string[];
    background?: string;
}) {
    if (changes.length === 0) return null;

    return (
        <span className="flex flex-wrap items-center gap-1.5">
            {changes.map((change) => (
                <span
                    key={change}
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{ background, color: T.NAVY }}
                >
                    {change}
                </span>
            ))}
        </span>
    );
}

/**
 * Post-action receipt shown above the list once a bulk action finishes — the
 * toast disappears, this does not, so the operator can see what actually
 * happened (including what was skipped) before moving on.
 */
export default function BulkActionSummary({ summary, onDismiss }: Props) {
    const skipped = (summary.skipped ?? []).filter((item) => item.count > 0);

    return (
        <div
            role="status"
            className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[10px] border px-4 py-3"
            style={{
                borderColor: T.GREEN_MID,
                background: T.GREEN_LIGHT,
            }}
        >
            <span
                className="text-sm font-semibold"
                style={{ color: T.GREEN }}
            >
                {fmt(summary.count)} {summary.entityLabel} {summary.verb}
            </span>

            <ChangeChips changes={summary.changes ?? []} />

            {skipped.length > 0 && (
                <span className="text-xs" style={{ color: T.TEXT_MUTED }}>
                    {skipped
                        .map((item) => `${fmt(item.count)} ${item.reason}`)
                        .join(" · ")}
                </span>
            )}

            <button
                type="button"
                onClick={onDismiss}
                className="ml-auto cursor-pointer border-none bg-transparent p-0 text-xs font-semibold"
                style={{ color: T.TEXT_MUTED }}
            >
                Dismiss
            </button>
        </div>
    );
}

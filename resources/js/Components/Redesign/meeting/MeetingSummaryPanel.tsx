import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { DealFollowup, MeetingSummary } from "@/Types/api/deal-followup";
import type { MeetingSummaryState } from "@/Components/Redesign/meeting/meetingSummaryState";
import MeetingSummaryEditor from "@/Components/Redesign/meeting/MeetingSummaryEditor";
import useMeetingSummaryActions, {
    type SummarySection,
} from "@/Components/Redesign/meeting/useMeetingSummaryActions";

dayjs.extend(utc);

interface MeetingSummaryPanelProps {
    meeting: DealFollowup;
    /** Why there is no summary, when there isn't one. */
    state: MeetingSummaryState;
    /** May write or correct this meeting's summary. */
    canEdit?: boolean;
    /** Called once a change is saved, for a page that shows the summary elsewhere. */
    onChanged?: () => void;
}

/** The sections the panel can show as text, in the order they were stored. */
function toSections(summary: MeetingSummary | null | undefined): SummarySection[] {
    return (Object.entries(summary?.summary_object ?? {}) as [string, unknown][])
        .map(([key, value]): SummarySection | null => {
            if (typeof value === "string" || typeof value === "number") {
                return { key, value: String(value) };
            }
            if (Array.isArray(value)) {
                const text = value
                    .filter(
                        (item) =>
                            typeof item === "string" ||
                            typeof item === "number",
                    )
                    .join(", ");
                return text ? { key, value: text } : null;
            }
            // An object (or anything else unexpected) has no sane plain-text
            // form — showing it would just print "[object Object]".
            return null;
        })
        .filter((entry): entry is SummarySection => entry !== null);
}

/**
 * The meeting's summary, as the detail dialog's second tab.
 *
 * Every state is spelled out rather than left as an empty panel, and none of
 * them is a dead end. An automatic summary is only ever produced for a video
 * meeting that has happened, so "nothing here" says which of those is missing;
 * "generating" is only claimed for as long as one can still arrive, after which
 * it says it did not and offers asking again (where that is set up) and
 * writing it by hand. A person's version is kept, and an automatic one that
 * turns up later is offered beside it rather than written over it.
 */
export default function MeetingSummaryPanel({
    meeting,
    state,
    canEdit = false,
    onChanged,
}: MeetingSummaryPanelProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { formatDateTime } = useUserDateTime();
    const { props } = usePage();
    const retryAvailable =
        (props as { summaryRetryAvailable?: boolean }).summaryRetryAvailable ===
        true;

    // Held locally so a save or a retry shows at once, whichever page opened
    // the dialog; reset whenever it is pointed at a different meeting.
    const [summary, setSummary] = useState<MeetingSummary | null>(
        meeting.meeting_summary ?? null,
    );
    const [asked, setAsked] = useState(false);
    const [editing, setEditing] = useState(false);
    const [confirmAutomatic, setConfirmAutomatic] = useState(false);
    const { saveSummary, adoptAutomaticSummary, retrySummary, saving, error, clearError } =
        useMeetingSummaryActions(meeting.id);

    useEffect(() => {
        setSummary(meeting.meeting_summary ?? null);
        setAsked(false);
        setEditing(false);
        clearError();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per meeting, not per render
    }, [meeting.id]);

    const sections = toSections(summary);
    const hasSummary = sections.length > 0;
    const started = dayjs.utc(meeting.next_follow_up_date).isBefore(dayjs());
    // The server refuses a summary for a meeting that has not started.
    const canWrite = canEdit && started;
    const effectiveState: MeetingSummaryState = hasSummary
        ? "ready"
        : asked
          ? "generating"
          : state;

    const handleSave = async (next: SummarySection[]) => {
        const result = await saveSummary(next);
        if (result?.success) {
            setSummary(result.meeting_summary ?? null);
            setEditing(false);
            message.success(td("Summary saved"));
            onChanged?.();
        }
    };

    const handleAdopt = async () => {
        setConfirmAutomatic(false);
        const result = await adoptAutomaticSummary();
        if (result?.success) {
            setSummary(result.meeting_summary ?? null);
            message.success(td("Switched to the automatic summary"));
            onChanged?.();
        }
    };

    const handleRetry = async () => {
        const result = await retrySummary();
        if (result?.success) {
            setAsked(true);
            message.success(
                result.message ?? td("Asked for the summary again"),
            );
            onChanged?.();
        }
    };

    if (editing) {
        return (
            <MeetingSummaryEditor
                initial={sections}
                saving={saving}
                error={error}
                onSave={handleSave}
                onCancel={() => {
                    clearError();
                    setEditing(false);
                }}
            />
        );
    }

    if (!hasSummary) {
        const writeButton = canWrite && (
            <Button
                variant={
                    effectiveState === "stalled" && retryAvailable
                        ? "ghost"
                        : effectiveState === "generating"
                          ? "ghost"
                          : "primary"
                }
                size="sm"
                onClick={() => setEditing(true)}
                disabled={saving}
            >
                {effectiveState === "generating"
                    ? td("Write it myself")
                    : td("Write the summary")}
            </Button>
        );
        const askButton = effectiveState === "stalled" &&
            retryAvailable &&
            canWrite && (
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRetry}
                    loading={saving}
                    disabled={saving}
                >
                    {td("Ask for it again")}
                </Button>
            );

        const footer =
            askButton || writeButton ? (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {askButton}
                    {writeButton}
                </div>
            ) : undefined;

        const failure = error ? (
            <p
                role="alert"
                className="m-0 mt-2"
                style={{ fontSize: 13, color: T.RED }}
            >
                {td(error)}
            </p>
        ) : null;

        if (effectiveState === "generating") {
            return (
                <>
                    <EmptyState
                        icon="clock"
                        title={t("pages.meetings.card.generating_summary")}
                        description={td(
                            asked
                                ? "Asked again. The summary appears here once it is ready."
                                : "The recording is still being processed. The summary appears here once it is ready.",
                        )}
                        footer={footer}
                    />
                    {failure}
                </>
            );
        }

        if (effectiveState === "stalled") {
            return (
                <>
                    <EmptyState
                        icon="file-text"
                        title={td("The summary did not arrive")}
                        description={td(
                            retryAvailable
                                ? "It should have been ready by now. Ask for it again, or write it yourself."
                                : "It should have been ready by now. You can write it yourself.",
                        )}
                        footer={footer}
                    />
                    {failure}
                </>
            );
        }

        return (
            <>
                <EmptyState
                    icon="file-text"
                    title={td("No summary for this meeting")}
                    description={td(
                        "Automatic summaries are built from the recording of a Zoho or Zoom meeting. For any other meeting, you can write one yourself.",
                    )}
                    footer={footer}
                />
                {failure}
            </>
        );
    }

    const manual = summary?.source === "manual";
    const hasAutomatic =
        manual &&
        summary?.ai_summary_object != null &&
        Object.keys(summary.ai_summary_object).length > 0;

    return (
        <div className="space-y-3">
            {sections.map(({ key, value }) => (
                <div key={key}>
                    <span
                        className="mb-1 block font-semibold uppercase"
                        style={{
                            fontSize: 11,
                            letterSpacing: "0.06em",
                            color: T.TEXT_HINT,
                        }}
                    >
                        {td(key.replace(/[_-]/g, " "))}
                    </span>
                    <p
                        className="m-0 leading-relaxed"
                        style={{ fontSize: 13, color: T.TEXT }}
                    >
                        {td(value)}
                    </p>
                </div>
            ))}

            {hasAutomatic && (
                <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5"
                    style={{
                        background: T.AMBER_BANNER,
                        border: `1px solid ${T.AMBER_MID}`,
                        fontSize: 13,
                        color: T.TEXT,
                    }}
                >
                    <span>
                        {td(
                            "An automatic summary arrived after yours. Yours is kept.",
                        )}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmAutomatic(true)}
                        disabled={saving}
                    >
                        {td("Use the automatic one")}
                    </Button>
                </div>
            )}

            {error && (
                <p role="alert" className="m-0" style={{ fontSize: 13, color: T.RED }}>
                    {td(error)}
                </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0" style={{ fontSize: 11, color: T.TEXT_HINT }}>
                    {manual ? (
                        <>
                            {td("Written by")}{" "}
                            {summary?.editor?.name ?? td("a team member")}
                            {summary?.edited_at &&
                                ` · ${formatDateTime(summary.edited_at, {
                                    separator: " at ",
                                })}`}
                        </>
                    ) : (
                        summary?.created_at && (
                            <>
                                {td("Generated")}{" "}
                                {formatDateTime(summary.created_at, {
                                    separator: " at ",
                                })}
                            </>
                        )
                    )}
                </p>
                {canWrite && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(true)}
                    >
                        {td("Edit summary")}
                    </Button>
                )}
            </div>

            <ConfirmDialog
                open={confirmAutomatic}
                title={td("Use the automatic summary?")}
                message={td(
                    "It replaces the version written by hand. This cannot be undone.",
                )}
                confirmLabel={td("Use automatic")}
                danger
                onConfirm={handleAdopt}
                onCancel={() => setConfirmAutomatic(false)}
            />
        </div>
    );
}

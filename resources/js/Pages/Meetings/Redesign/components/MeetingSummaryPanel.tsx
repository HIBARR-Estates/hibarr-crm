import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { MeetingSummaryState } from "../adapters/meetingViewModel";

interface MeetingSummaryPanelProps {
    meeting: DealFollowup;
    /** Why there is no summary, when there isn't one. */
    state: MeetingSummaryState;
}

/**
 * The meeting's AI summary, as the detail dialog's second tab.
 *
 * Every state is spelled out rather than left as an empty panel: a summary is
 * only ever produced for a video meeting that has actually happened, so
 * "nothing here" needs to say which of those is missing.
 */
export default function MeetingSummaryPanel({
    meeting,
    state,
}: MeetingSummaryPanelProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { formatDateTime } = useUserDateTime();

    const entries = (
        Object.entries(meeting.meeting_summary?.summary_object ?? {}) as [
            string,
            unknown,
        ][]
    )
        .map(([key, value]): [string, string] | null => {
            if (typeof value === "string" || typeof value === "number") {
                return [key, String(value)];
            }
            if (Array.isArray(value)) {
                const text = value
                    .filter(
                        (item) =>
                            typeof item === "string" ||
                            typeof item === "number",
                    )
                    .join(", ");
                return text ? [key, text] : null;
            }
            // An object (or anything else unexpected) has no sane plain-text
            // form — showing it would just print "[object Object]".
            return null;
        })
        .filter((entry): entry is [string, string] => entry !== null);

    if (entries.length === 0) {
        if (state === "generating") {
            return (
                <EmptyState
                    icon="clock"
                    title={t("pages.meetings.card.generating_summary")}
                    description={td(
                        "The recording is still being processed. The summary appears here once it is ready.",
                    )}
                />
            );
        }
        return (
            <EmptyState
                icon="file-text"
                title={td("No summary for this meeting")}
                description={td(
                    "Summaries are built from the recording of a Zoho or Zoom meeting. Meetings held on another platform, by phone or in person cannot produce one.",
                )}
            />
        );
    }

    return (
        <div className="space-y-3">
            {entries.map(([key, value]) => (
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

            {meeting.meeting_summary?.created_at && (
                <p className="m-0" style={{ fontSize: 11, color: T.TEXT_HINT }}>
                    {td("Generated")}{" "}
                    {formatDateTime(meeting.meeting_summary.created_at, {
                        separator: " at ",
                    })}
                </p>
            )}
        </div>
    );
}

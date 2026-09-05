import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { MeetingSummaryState } from "../adapters/meetingViewModel";

interface MeetingSummaryPanelProps {
    meeting: DealFollowup;
    /** Why there is no summary, when there isn't one. */
    state: MeetingSummaryState;
}

function Notice({
    icon,
    title,
    body,
}: {
    icon: string;
    title: string;
    body: string;
}) {
    return (
        <div
            className="flex flex-col items-center gap-2 px-6 py-10 text-center"
            style={{
                background: T.SURFACE_2,
                border: `1px solid ${T.BORDER}`,
                borderRadius: R.LG,
            }}
        >
            <Icon name={icon} size={22} color={T.TEXT_HINT} />
            <div
                className="font-semibold"
                style={{ fontSize: 14, color: T.TEXT }}
            >
                {title}
            </div>
            <div style={{ fontSize: 13, color: T.TEXT_MUTED, maxWidth: 340 }}>
                {body}
            </div>
        </div>
    );
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

    const entries = Object.entries(
        meeting.meeting_summary?.summary_object ?? {},
    );

    if (entries.length === 0) {
        if (state === "generating") {
            return (
                <Notice
                    icon="clock"
                    title={t("pages.meetings.card.generating_summary")}
                    body={td(
                        "The recording is still being processed. This page will show the summary once it is ready.",
                    )}
                />
            );
        }
        return (
            <Notice
                icon="file-text"
                title={td("No summary for this meeting")}
                body={td(
                    "Summaries are generated from video meetings once they have taken place.",
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
                        {td(String(value))}
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

import { useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealIcon from "../../primitives/DealIcon";
import type { WorkspaceMeetingPreview } from "../../../adapters/meetingAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import {
    OverviewColumnHeader,
    OverviewColumnShell,
    OverviewEmptyMini,
    OverviewViewLink,
} from "./overviewShared";

interface OverviewMeetingsColumnProps {
    meetings: WorkspaceMeetingPreview[];
    upcomingCount: number;
    onAddMeeting: () => void;
    onViewMeeting: () => void;
}

export default function OverviewMeetingsColumn({
    meetings,
    upcomingCount,
    onAddMeeting,
    onViewMeeting,
}: OverviewMeetingsColumnProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [expandedId, setExpandedId] = useState<number | null>(null);

    return (
        <OverviewColumnShell borderSide="right">
            <OverviewColumnHeader
                icon="calendar"
                iconBg={T.AMBER_SOFT}
                iconColor={T.AMBER}
                title={t("pages.deals.tabs.meeting")}
                count={upcomingCount}
                onAdd={onAddMeeting}
            />
            <div className="max-h-[560px] overflow-y-auto pr-0.5">
                {meetings.length === 0 ? (
                    <OverviewEmptyMini icon="calendar" label={td("No meetings yet")} />
                ) : (
                    meetings.map((meeting) => {
                        const expanded = expandedId === meeting.id;
                        return (
                            <article
                                key={meeting.id}
                                className="mb-2 cursor-pointer rounded-lg border border-[#e2e5ea] bg-white px-3 py-2.5"
                                style={{ opacity: meeting.isPast ? 0.7 : 1 }}
                                onClick={() =>
                                    setExpandedId(expanded ? null : meeting.id)
                                }
                            >
                                <div className="flex gap-2.5">
                                    <div
                                        className="w-[38px] shrink-0 rounded-md px-1 py-1.5 text-center"
                                        style={{
                                            background: meeting.isPast
                                                ? T.GRAY
                                                : T.BLUE_LIGHT,
                                            border: `1px solid ${
                                                meeting.isPast ? T.BORDER : T.BLUE_MID
                                            }`,
                                        }}
                                    >
                                        <div className="text-[9px] uppercase text-[#9ca3af]">
                                            {meeting.monthLabel}
                                        </div>
                                        <div
                                            className="text-[15px] font-semibold leading-tight"
                                            style={{
                                                color: meeting.isPast
                                                    ? T.TEXT_MUTED
                                                    : T.BLUE,
                                            }}
                                        >
                                            {meeting.dayLabel}
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-0.5 text-xs font-medium text-[#1a1f2e]">
                                            {meeting.title}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-[#9ca3af]">
                                            <DealIcon name="clock" size={11} />
                                            {meeting.timeLabel}
                                            {meeting.isPast ? ` · ${td("Past")}` : ""}
                                        </div>
                                        {expanded && (
                                            <div className="mt-1.5 border-t border-[#e2e5ea] pt-1.5 text-[11px] leading-relaxed text-[#5b6472]">
                                                <div className="mb-1 flex items-center gap-1">
                                                    <DealIcon
                                                        name={
                                                            meeting.locationType ===
                                                            "video"
                                                                ? "video"
                                                                : "map-pin"
                                                        }
                                                        size={11}
                                                    />
                                                    {meeting.location}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <DealIcon name="users" size={11} />
                                                    {meeting.attendeesLabel}
                                                </div>
                                            </div>
                                        )}
                                        <div className="mt-1.5 text-right">
                                            <OverviewViewLink
                                                label={td("View meeting ↗")}
                                                onClick={onViewMeeting}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </OverviewColumnShell>
    );
}

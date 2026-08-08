import DateBlock from "@/Components/Redesign/primitives/DateBlock";
import { getMeetingStatusTone } from "@/Pages/Deals/Redesign/adapters/meetingListAdapter";
import type { LeadMeetingPreview } from "../../../adapters/meetingAdapter";

interface MeetingCardProps {
    meeting: LeadMeetingPreview;
    onClick?: () => void;
}

export default function MeetingCard({ meeting, onClick }: MeetingCardProps) {
    const statusTone = getMeetingStatusTone(meeting.status);

    return (
        <button
            type="button"
            className="v2-meeting-card mb-2 flex w-full cursor-pointer gap-3 text-left"
            onClick={onClick}
        >
            <DateBlock
                monthLabel={meeting.monthLabel}
                dayLabel={meeting.dayLabel}
                muted={meeting.isPast}
            />
            <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-[#1a1f2e]">
                        {meeting.title}
                    </span>
                    <span className={`v2-pill ${statusTone.replace("dr-", "v2-")}`}>
                        {meeting.status}
                    </span>
                </div>
                <div className="text-[11px] text-[#9ca3af]">
                    {meeting.timeLabel}
                    {meeting.attendeesLabel
                        ? ` · ${meeting.attendeesLabel}`
                        : ""}
                </div>
            </div>
        </button>
    );
}

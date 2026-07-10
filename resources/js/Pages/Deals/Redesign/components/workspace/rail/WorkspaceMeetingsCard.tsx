import { useTd } from "@/Hooks/useDynamicTranslation";
import DealIcon from "../../primitives/DealIcon";
import DealPanelHeader from "../../primitives/DealPanelHeader";
import type { WorkspaceMeetingPreview } from "../../../adapters/meetingAdapter";

interface WorkspaceMeetingsCardProps {
    meetings: WorkspaceMeetingPreview[];
    onAddMeeting: () => void;
    onOpenMeetings: () => void;
}

export default function WorkspaceMeetingsCard({
    meetings,
    onAddMeeting,
    onOpenMeetings,
}: WorkspaceMeetingsCardProps) {
    const { td } = useTd();

    return (
        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
            <DealPanelHeader
                title={td("Next meeting")}
                rightSlot={
                    <button
                        type="button"
                        onClick={onAddMeeting}
                        className="border-none bg-transparent text-[11px] font-semibold text-white/85 hover:text-white"
                    >
                        + {td("Book")}
                    </button>
                }
            />
            {meetings.length === 0 ? (
                <p className="px-[13px] py-2.5 text-[13px] italic text-[#9ca3af]">
                    {td("No meetings scheduled.")}
                </p>
            ) : (
                <div className="divide-y divide-[#e2e5ea]">
                    {meetings.map((meeting) => (
                        <button
                            key={meeting.id}
                            type="button"
                            onClick={onOpenMeetings}
                            className="w-full px-[13px] py-2.5 text-left hover:bg-[#f9fafb]"
                        >
                            <div className="mb-1 text-xs font-medium text-[#1a1f2e]">
                                {meeting.title}
                            </div>
                            <div className="text-[11px] text-[#6b7280]">
                                {meeting.startsAtLabel}
                                {meeting.isPast ? ` · ${td("Past")}` : ""}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#9ca3af]">
                                <DealIcon
                                    name={
                                        meeting.locationType === "video"
                                            ? "video"
                                            : "map-pin"
                                    }
                                    size={11}
                                />
                                <span className="truncate">{meeting.location}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}

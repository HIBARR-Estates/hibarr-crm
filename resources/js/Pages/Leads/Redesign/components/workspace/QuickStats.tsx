interface QuickStatsProps {
    nextMeetingLabel?: string;
    openTasksCount?: number;
    dealsCount?: number;
    onSchedule?: () => void;
    onCreateTask?: () => void;
    onCreateDeal?: () => void;
}

export default function QuickStats({
    nextMeetingLabel,
    openTasksCount = 0,
    dealsCount = 0,
    onSchedule,
    onCreateTask,
    onCreateDeal,
}: QuickStatsProps) {
    return (
        <div className="v2-quick-stats">
            <div className="v2-quick-stat">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    Next meeting
                </span>
                {nextMeetingLabel ? (
                    <span className="text-[13px] font-medium text-[#1a1f2e]">
                        {nextMeetingLabel}
                    </span>
                ) : (
                    <button
                        type="button"
                        className="v2-btn-link !px-0 !text-[#1a6bb5]"
                        onClick={onSchedule}
                    >
                        + Schedule
                    </button>
                )}
            </div>

            <div className="v2-quick-stat">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    Open tasks
                </span>
                {openTasksCount > 0 ? (
                    <span className="text-[13px] font-medium text-[#1a1f2e]">
                        {openTasksCount} open
                    </span>
                ) : (
                    <button
                        type="button"
                        className="v2-btn-link !px-0 !text-[#1a6bb5]"
                        onClick={onCreateTask}
                    >
                        + Create
                    </button>
                )}
            </div>

            <div className="v2-quick-stat">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    Deals
                </span>
                {dealsCount > 0 ? (
                    <span className="text-[13px] font-medium text-[#1a1f2e]">
                        {dealsCount} linked
                    </span>
                ) : (
                    <button
                        type="button"
                        className="v2-btn-link !px-0 !text-[#1a6bb5]"
                        onClick={onCreateDeal}
                    >
                        + Create
                    </button>
                )}
            </div>
        </div>
    );
}

import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import AnalysisSectionNavItem from "./AnalysisSectionNavItem";
import TaskPopover from "./popovers/TaskPopover";
import MeetingPopover from "./popovers/MeetingPopover";
import type { AnalysisSection } from "./types/analysisTypes";

interface Props {
    sections: AnalysisSection[];
    sectionProgress: Record<string, { filled: number; total: number }>;
    activeSection: string;
    /** Sections at or past this index are not revealed yet and can't be jumped to. */
    unlockedCount?: number;
    totalFilled: number;
    totalFields: number;
    isCompleting: boolean;
    allFilled: boolean;
    onJump: (id: string) => void;
    onScheduleMeeting: () => void;
    onComplete: () => void;
}

export default function AnalysisSectionNavigator({
    sections,
    sectionProgress,
    activeSection,
    unlockedCount,
    totalFilled,
    totalFields,
    isCompleting,
    allFilled,
    onJump,
    onScheduleMeeting,
    onComplete,
}: Props) {
    const { td } = useTd();
    const [taskOpen, setTaskOpen] = useState(false);
    const [meetingOpen, setMeetingOpen] = useState(false);

    return (
        <div
            className="flex flex-col absolute inset-0"
            style={{ background: T.SURFACE }}
        >
            {/* Header */}
            <div
                className="px-4 pt-4 pb-3 shrink-0"
                style={{ borderBottom: `1px solid ${T.BORDER}` }}
            >
                <p
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: T.TEXT_HINT }}
                >
                    {td("Sections", { source: "en" })}
                </p>
            </div>

            {/* Section list */}
            <div
                className="flex-1 overflow-y-auto min-h-0"
                style={{ borderBottom: `1px solid ${T.BORDER}` }}
            >
                {sections.map((section, i) => {
                    const p = sectionProgress[section.id] ?? { filled: 0, total: 0 };
                    return (
                        <AnalysisSectionNavItem
                            key={section.id}
                            title={td(section.title, { source: "en" })}
                            filled={p.filled}
                            total={p.total}
                            isActive={activeSection === section.id}
                            isLocked={unlockedCount !== undefined && i >= unlockedCount}
                            onClick={() => onJump(section.id)}
                        />
                    );
                })}
            </div>

            {/* Quick actions + Complete */}
            <div className="shrink-0 p-3 space-y-3">
                {/* Task + Meeting buttons */}
                <div className="relative space-y-2">
                    {taskOpen && (
                        <TaskPopover
                            open={taskOpen}
                            onClose={() => setTaskOpen(false)}
                        />
                    )}
                    {meetingOpen && (
                        <MeetingPopover
                            open={meetingOpen}
                            onClose={() => setMeetingOpen(false)}
                            onScheduleMeeting={onScheduleMeeting}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => { setMeetingOpen(false); setTaskOpen((o) => !o); }}
                        className="w-full py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: T.NAVY }}
                    >
                        + {td("Create Task", { source: "en" })}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setTaskOpen(false); setMeetingOpen((o) => !o); }}
                        className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
                        style={{
                            border: `1.5px solid ${T.NAVY}`,
                            color: T.NAVY,
                            backgroundColor: "transparent",
                        }}
                    >
                        📅 {td("Schedule Meeting", { source: "en" })}
                    </button>
                </div>

                {/* Complete button */}
                <button
                    type="button"
                    disabled={isCompleting}
                    onClick={onComplete}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={
                        allFilled
                            ? { backgroundColor: "#10b981", color: "#fff" }
                            : { backgroundColor: T.AMBER_SOFT, color: T.AMBER, border: `1px solid ${T.AMBER_MID}` }
                    }
                >
                    {isCompleting
                        ? td("Completing…", { source: "en" })
                        : allFilled
                            ? td("Complete Analysis ✓", { source: "en" })
                            : `${td("Complete", { source: "en" })} (${totalFields - totalFilled} ${td("missing", { source: "en" })})`
                    }
                </button>
            </div>
        </div>
    );
}

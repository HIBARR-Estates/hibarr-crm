import { useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { WorkspaceSubTab } from "../../types";
import type { WorkspaceMeetingPreview } from "../../adapters/meetingAdapter";
import type { WorkspaceNotePreview } from "../../adapters/noteAdapter";
import type { WorkspaceTaskPreview } from "../../adapters/taskAdapter";

interface WorkspaceOverviewTabProps {
    notes: WorkspaceNotePreview[];
    tasks: WorkspaceTaskPreview[];
    meetings: WorkspaceMeetingPreview[];
    onNavigateToSubTab: (tab: WorkspaceSubTab) => void;
}

interface OverviewColumnCardProps {
    title: string;
    actionLabel: string;
    preview: Array<{ id: number; title: string; subtitle: string; content: string }>;
    emptyDescription: string;
    onAction: () => void;
}

function OverviewColumnCard({
    title,
    actionLabel,
    preview,
    emptyDescription,
    onAction,
}: OverviewColumnCardProps) {
    const [expanded, setExpanded] = useState(false);
    const visibleItems = expanded ? preview : preview.slice(0, 3);
    const canExpand = preview.length > 3;

    return (
        <section className="rounded-[10px] border border-[#e2e5ea] bg-white">
            <header className="flex items-center justify-between border-b border-[#eef1f5] px-4 py-3">
                <h3 className="text-sm font-semibold text-[#1a1f2e]">{title}</h3>
                <button
                    type="button"
                    className="text-xs font-medium text-[#1a6bb5] hover:text-[#145890]"
                    onClick={onAction}
                >
                    {actionLabel}
                </button>
            </header>

            <div className="space-y-3 px-4 py-3">
                {visibleItems.length === 0 && (
                    <p className="rounded-[8px] border border-dashed border-[#d6dbe2] bg-[#f9fafb] px-3 py-4 text-xs text-[#667085]">
                        {emptyDescription}
                    </p>
                )}

                {visibleItems.map((item) => (
                    <article key={item.id} className="rounded-[8px] border border-[#edf1f5] bg-[#fbfcfd] p-3">
                        <p className="truncate text-sm font-medium text-[#111827]">{item.title}</p>
                        <p className="mt-0.5 text-[11px] text-[#6b7280]">{item.subtitle}</p>
                        <p className="mt-2 max-h-[54px] overflow-hidden text-xs text-[#4b5563]">
                            {item.content}
                        </p>
                    </article>
                ))}

                {canExpand && (
                    <button
                        type="button"
                        className="text-xs font-medium text-[#1a6bb5] hover:text-[#145890]"
                        onClick={() => setExpanded((state) => !state)}
                    >
                        {expanded ? "Show less" : `Show ${preview.length - 3} more`}
                    </button>
                )}
            </div>
        </section>
    );
}

export default function WorkspaceOverviewTab({
    notes,
    tasks,
    meetings,
    onNavigateToSubTab,
}: WorkspaceOverviewTabProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const notePreview = useMemo(
        () =>
            notes.slice(0, 7).map((note) => ({
                id: note.id,
                title: note.title,
                subtitle: note.createdAtLabel,
                content: note.preview,
            })),
        [notes],
    );
    const taskPreview = useMemo(
        () =>
            tasks.slice(0, 7).map((task) => ({
                id: task.id,
                title: task.title,
                subtitle: `${task.priority.toUpperCase()} priority · ${task.dueDateLabel}`,
                content: task.description,
            })),
        [tasks],
    );
    const meetingPreview = useMemo(
        () =>
            meetings.slice(0, 7).map((meeting) => ({
                id: meeting.id,
                title: meeting.title,
                subtitle: `${meeting.startsAtLabel} · ${meeting.status}`,
                content: meeting.isUpcoming
                    ? "Upcoming meeting in workspace schedule."
                    : "Meeting already happened. Open meetings tab for full details.",
            })),
        [meetings],
    );

    return (
        <div className="grid gap-4 xl:grid-cols-3">
            <OverviewColumnCard
                title={t("pages.deals.tabs.notes")}
                actionLabel={td("View Notes ↗")}
                preview={notePreview}
                emptyDescription={td("No notes found. Add one from the notes tab.")}
                onAction={() => onNavigateToSubTab("notes")}
            />
            <OverviewColumnCard
                title={td("Tasks")}
                actionLabel={td("View Tasks ↗")}
                preview={taskPreview}
                emptyDescription={td("No tasks found. Add one from the tasks tab.")}
                onAction={() => onNavigateToSubTab("tasks")}
            />
            <OverviewColumnCard
                title={t("pages.deals.tabs.meeting")}
                actionLabel={td("View Meetings ↗")}
                preview={meetingPreview}
                emptyDescription={td("No meetings found. Schedule one from the meetings tab.")}
                onAction={() => onNavigateToSubTab("meetings")}
            />
        </div>
    );
}

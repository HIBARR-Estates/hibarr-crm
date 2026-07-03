import { useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadDrawerTab } from "../../../types";
import type useLeadOverview from "../../../hooks/useLeadOverview";

type OverviewData = ReturnType<typeof useLeadOverview>;

interface OverviewPaneProps {
    overview: OverviewData;
    onNavigate: (tab: LeadDrawerTab) => void;
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
                    <article
                        key={item.id}
                        className="rounded-[8px] border border-[#edf1f5] bg-[#fbfcfd] p-3"
                    >
                        <p className="truncate text-sm font-medium text-[#111827]">
                            {item.title}
                        </p>
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

export default function OverviewPane({ overview, onNavigate }: OverviewPaneProps) {
    const { t } = useTranslation();

    const notePreview = useMemo(
        () =>
            overview.notes.slice(0, 7).map((note) => ({
                id: note.id,
                title: note.title,
                subtitle: note.createdAtLabel,
                content: note.preview,
            })),
        [overview.notes],
    );

    const taskPreview = useMemo(
        () =>
            overview.tasks.slice(0, 7).map((task) => ({
                id: task.id,
                title: task.title,
                subtitle: `${task.priority.toUpperCase()} priority · ${task.dueDateLabel}`,
                content: task.description,
            })),
        [overview.tasks],
    );

    const meetingPreview = useMemo(
        () =>
            overview.meetings.slice(0, 7).map((meeting) => ({
                id: meeting.id,
                title: meeting.title,
                subtitle: `${meeting.startsAtLabel} · ${meeting.status}`,
                content: meeting.isUpcoming
                    ? "Upcoming meeting in lead schedule."
                    : "Meeting already happened. Open meetings tab for full details.",
            })),
        [overview.meetings],
    );

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <OverviewColumnCard
                title={t("pages.leads.tabs.notes")}
                actionLabel="View all"
                preview={notePreview}
                emptyDescription="No notes yet. Add a quick note above or open the notes tab."
                onAction={() => onNavigate("notes")}
            />
            <OverviewColumnCard
                title={t("pages.leads.tabs.tasks")}
                actionLabel="View all"
                preview={taskPreview}
                emptyDescription="No tasks yet."
                onAction={() => onNavigate("tasks")}
            />
            <OverviewColumnCard
                title={t("modules.lead.followUp")}
                actionLabel="View all"
                preview={meetingPreview}
                emptyDescription="No meetings scheduled."
                onAction={() => onNavigate("meetings")}
            />
        </div>
    );
}

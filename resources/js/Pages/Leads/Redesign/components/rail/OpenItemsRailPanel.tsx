import useTranslation from "@/Hooks/useTranslation";
import LeadIcon from "../primitives/LeadIcon";
import type { LeadContextRailData } from "../../types";

interface OpenItemsRailPanelProps {
    data: LeadContextRailData;
    marketingSource?: string | null;
    onNavigateMeetings?: () => void;
    onNavigateTasks?: () => void;
    onNavigateDeals?: () => void;
}

export default function OpenItemsRailPanel({
    data,
    marketingSource,
    onNavigateMeetings,
    onNavigateTasks,
    onNavigateDeals,
}: OpenItemsRailPanelProps) {
    const { t } = useTranslation();

    const items = [
        {
            label: t("pages.leads.tabs.tasks"),
            count: data.openTasksCount,
            detail: data.topOpenTask?.title,
            icon: "check",
            onClick: onNavigateTasks,
        },
        {
            label: t("modules.lead.followUp"),
            count: data.upcomingMeetingsCount,
            detail: data.nextMeeting?.startsAtLabel,
            icon: "calendar",
            onClick: onNavigateMeetings,
        },
        {
            label: t("app.deal"),
            count: data.dealsCount,
            detail: data.dealsCount > 0 ? `${data.dealsCount} linked` : undefined,
            icon: "briefcase",
            onClick: onNavigateDeals,
        },
    ];

    return (
        <section className="rail-panel">
            <header className="border-b border-[#eef1f5] px-3 py-2.5">
                <h3 className="text-xs font-semibold text-[#1a1f2e]">Open items</h3>
            </header>
            <div className="space-y-2 p-3">
                {items.map((item) => (
                    <button
                        key={item.label}
                        type="button"
                        className="w-full rounded-md border border-[#edf1f5] px-2.5 py-2 text-left transition-colors hover:border-[#b8d4f0] hover:bg-[#f8fbff]"
                        onClick={item.onClick}
                    >
                        <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151]">
                                <LeadIcon name={item.icon} size={12} />
                                {item.label}
                            </span>
                            <span className="rounded bg-[#e8f1fb] px-1.5 py-0.5 text-[10px] font-semibold text-[#1a6bb5]">
                                {item.count}
                            </span>
                        </div>
                        {item.detail && (
                            <p className="mt-1 truncate text-[10px] text-[#9ca3af]">
                                {item.detail}
                            </p>
                        )}
                    </button>
                ))}
                {marketingSource && (
                    <div className="rounded-md border border-dashed border-[#e2e5ea] px-2.5 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af]">
                            UTM Source
                        </p>
                        <p className="mt-0.5 text-xs text-[#374151]">{marketingSource}</p>
                    </div>
                )}
            </div>
        </section>
    );
}

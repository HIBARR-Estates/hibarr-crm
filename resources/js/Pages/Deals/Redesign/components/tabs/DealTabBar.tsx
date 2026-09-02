import { KeyboardEvent } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { DealTab, DealTabCount } from "../../types";
import useHScroll from "../../hooks/useHScroll";
import DealIcon from "../primitives/DealIcon";
import DealScrollArrow from "../primitives/DealScrollArrow";

// Icons for the meta tabs only — they sit past the divider and are easy to
// miss, so an icon makes Deal info / Timeline stand out. Record tabs stay
// text-only (matching v2.2).
const META_TAB_ICONS: Partial<Record<DealTab, string>> = {
    dealinfo: "info",
    timeline: "clock",
};

interface DealTabBarProps {
    activeTab: DealTab;
    counts: DealTabCount;
    visibleTabs: DealTab[];
    onChange: (tab: DealTab) => void;
}

const RECORD_TABS: Array<{ id: DealTab; countKey?: keyof DealTabCount }> = [
    { id: "overview" },
    { id: "notes", countKey: "notes" },
    { id: "tasks", countKey: "tasks" },
    { id: "meetings", countKey: "meetings" },
    { id: "files", countKey: "files" },
    { id: "offers", countKey: "offers" },
    { id: "exposes", countKey: "exposes" },
    { id: "recommendations", countKey: "recommendations" },
    { id: "itinerary", countKey: "itinerary" },
];

const META_TABS: DealTab[] = ["dealinfo", "timeline"];

export default function DealTabBar({
    activeTab,
    counts,
    visibleTabs,
    onChange,
}: DealTabBarProps) {
    const { t } = useTranslation();
    const scroll = useHScroll();
    const hasOverflow = scroll.overflow.left || scroll.overflow.right;

    const labels: Record<DealTab, string> = {
        overview: t("pages.deals.header.tabs.overview"),
        notes: t("pages.deals.tabs.notes"),
        tasks: t("pages.deals.header.tabs.tasks"),
        meetings: t("pages.deals.tabs.meeting"),
        files: t("pages.deals.tabs.files"),
        offers: t("pages.deals.tabs.offers"),
        exposes: t("pages.deals.workspace.exposes.title"),
        recommendations: t("pages.deals.tabs.recommendations"),
        itinerary: t("pages.flight_itinerary.tab"),
        dealinfo: t("pages.deals.header.tabs.deal_info"),
        timeline: t("pages.deals.header.tabs.timeline"),
    };

    const recordTabs = RECORD_TABS.filter((tab) => visibleTabs.includes(tab.id));
    const metaTabs = META_TABS.filter((tab) => visibleTabs.includes(tab));
    const orderedIds = [...recordTabs.map((tab) => tab.id), ...metaTabs];

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const index = orderedIds.indexOf(activeTab);
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % orderedIds.length;
        if (event.key === "ArrowLeft")
            next = (index - 1 + orderedIds.length) % orderedIds.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = orderedIds.length - 1;
        const nextTab = orderedIds[next];
        onChange(nextTab);
        document.getElementById(`deal-tab-${nextTab}`)?.focus();
    };

    const renderTab = (id: DealTab, countKey?: keyof DealTabCount) => {
        const isActive = activeTab === id;
        const count = countKey ? counts[countKey] : undefined;
        const icon = META_TAB_ICONS[id];
        return (
            <button
                key={id}
                id={`deal-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className="dr-tab"
                onClick={() => onChange(id)}
            >
                {icon && <DealIcon name={icon} size={14} />}
                {labels[id]}
                {count != null && <span className="dr-tab-count">{count}</span>}
            </button>
        );
    };

    return (
        <div className="dr-tabs">
            {hasOverflow && (
                <DealScrollArrow
                    dir="left"
                    enabled={scroll.overflow.left}
                    onClick={() => scroll.nudge(-1)}
                    label={t("pages.deals.header.tabs.scroll_left")}
                />
            )}
            <div
                ref={scroll.ref}
                onScroll={scroll.update}
                onKeyDown={handleKeyDown}
                role="tablist"
                aria-label={t("pages.deals.header.tabs.records_aria")}
                className="dr-tabs-scroll"
            >
                {recordTabs.map((tab) => renderTab(tab.id, tab.countKey))}
            </div>
            {hasOverflow && (
                <DealScrollArrow
                    dir="right"
                    enabled={scroll.overflow.right}
                    onClick={() => scroll.nudge(1)}
                    label={t("pages.deals.header.tabs.scroll_right")}
                />
            )}
            {metaTabs.length > 0 && (
                <>
                    <span className="dr-tabs-divider" aria-hidden="true" />
                    <div
                        className="dr-tabs-meta"
                        role="tablist"
                        aria-label={t("pages.deals.header.tabs.meta_aria")}
                        onKeyDown={handleKeyDown}
                    >
                        {metaTabs.map((id) => renderTab(id))}
                    </div>
                </>
            )}
        </div>
    );
}

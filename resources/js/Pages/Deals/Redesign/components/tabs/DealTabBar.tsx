import { KeyboardEvent } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DealTab, DealTabCount } from "../../types";
import useHScroll from "../../hooks/useHScroll";
import DealScrollArrow from "../primitives/DealScrollArrow";

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
    const { td } = useTd();
    const scroll = useHScroll();
    const hasOverflow = scroll.overflow.left || scroll.overflow.right;

    const labels: Record<DealTab, string> = {
        overview: td("Overview"),
        notes: t("pages.deals.tabs.notes"),
        tasks: td("Tasks"),
        meetings: t("pages.deals.tabs.meeting"),
        files: t("pages.deals.tabs.files"),
        offers: t("pages.deals.tabs.offers"),
        recommendations: t("pages.deals.tabs.recommendations"),
        itinerary: t("pages.flight_itinerary.tab"),
        dealinfo: td("Deal info"),
        timeline: td("Timeline"),
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
                    label="Scroll tabs left"
                />
            )}
            <div
                ref={scroll.ref}
                onScroll={scroll.update}
                onKeyDown={handleKeyDown}
                role="tablist"
                aria-label="Deal records"
                className="dr-tabs-scroll"
            >
                {recordTabs.map((tab) => renderTab(tab.id, tab.countKey))}
            </div>
            {hasOverflow && (
                <DealScrollArrow
                    dir="right"
                    enabled={scroll.overflow.right}
                    onClick={() => scroll.nudge(1)}
                    label="Scroll tabs right"
                />
            )}
            {metaTabs.length > 0 && (
                <>
                    <span className="dr-tabs-divider" aria-hidden="true" />
                    <div
                        className="dr-tabs-meta"
                        role="tablist"
                        aria-label="Deal info and timeline"
                        onKeyDown={handleKeyDown}
                    >
                        {metaTabs.map((id) => renderTab(id))}
                    </div>
                </>
            )}
        </div>
    );
}

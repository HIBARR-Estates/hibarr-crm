import { KeyboardEvent } from "react";
import { Icon } from "@/Components/Redesign";
import useHScroll from "@/Pages/Deals/Redesign/hooks/useHScroll";
import DealScrollArrow from "@/Pages/Deals/Redesign/components/primitives/DealScrollArrow";
import type { LeadTabCount, WorkspaceTabId } from "../../types";
import {
    META_TABS,
    RECORD_TABS,
} from "../../config/workspaceTabs";

const META_TAB_ICONS: Partial<Record<WorkspaceTabId, string>> = {
    leadinfo: "info",
    timeline: "clock",
};

interface WorkspaceTabBarProps {
    active: WorkspaceTabId;
    onChange: (tab: WorkspaceTabId) => void;
    counts?: LeadTabCount;
    /** When false, hide the Qualification record tab (feature flag). */
    showQualification?: boolean;
}

/**
 * Same record/meta split as Deals DealTabBar — horizontal scroll + divider +
 * iconed Lead info / Timeline meta tabs.
 */
export default function WorkspaceTabBar({
    active,
    onChange,
    counts = {},
    showQualification = true,
}: WorkspaceTabBarProps) {
    const scroll = useHScroll();
    const hasOverflow = scroll.overflow.left || scroll.overflow.right;

    const recordTabs = showQualification
        ? RECORD_TABS
        : RECORD_TABS.filter((tab) => tab.id !== "qualification");

    const countFor = (id: WorkspaceTabId): number | undefined => {
        if (id === "notes") return counts.notes;
        if (id === "tasks") return counts.tasks;
        if (id === "meetings") return counts.meetings;
        if (id === "files") return counts.files;
        if (id === "deals") return counts.deals;
        if (id === "itinerary") return counts.itinerary;
        if (id === "qualification") return counts.qualification;
        return undefined;
    };

    const orderedIds: WorkspaceTabId[] = [
        ...recordTabs.map((t) => t.id),
        ...META_TABS.map((t) => t.id),
    ];

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const index = orderedIds.indexOf(active);
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % orderedIds.length;
        if (event.key === "ArrowLeft")
            next = (index - 1 + orderedIds.length) % orderedIds.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = orderedIds.length - 1;
        const nextTab = orderedIds[next];
        onChange(nextTab);
        document.getElementById(`lead-tab-${nextTab}`)?.focus();
    };

    const renderTab = (id: WorkspaceTabId, label: string, countable?: boolean) => {
        const isActive = active === id;
        const count = countable ? countFor(id) : undefined;
        const icon = META_TAB_ICONS[id];
        return (
            <button
                key={id}
                id={`lead-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className="dr-tab"
                onClick={() => onChange(id)}
            >
                {icon && <Icon name={icon} size={14} />}
                {label}
                {count != null && count > 0 && (
                    <span className="dr-tab-count">{count}</span>
                )}
            </button>
        );
    };

    return (
        <div className="dr-tabs" data-tour="lead-tabs">
            {hasOverflow && (
                <DealScrollArrow
                    dir="left"
                    enabled={scroll.overflow.left}
                    onClick={() => scroll.nudge(-1)}
                    label="Scroll left"
                />
            )}
            <div
                ref={scroll.ref}
                onScroll={scroll.update}
                onKeyDown={handleKeyDown}
                role="tablist"
                aria-label="Lead record tabs"
                className="dr-tabs-scroll"
            >
                {recordTabs.map((tab) =>
                    renderTab(tab.id, tab.label, tab.countable),
                )}
            </div>
            {hasOverflow && (
                <DealScrollArrow
                    dir="right"
                    enabled={scroll.overflow.right}
                    onClick={() => scroll.nudge(1)}
                    label="Scroll right"
                />
            )}
            <span className="dr-tabs-divider" aria-hidden="true" />
            <div
                className="dr-tabs-meta"
                role="tablist"
                aria-label="Lead meta tabs"
                onKeyDown={handleKeyDown}
            >
                {META_TABS.map((tab) => renderTab(tab.id, tab.label))}
            </div>
        </div>
    );
}

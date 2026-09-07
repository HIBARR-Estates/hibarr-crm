import type { ReactNode } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import EntityListHeader, {
    type EntityListHeaderViewOption,
} from "@/Components/Redesign/primitives/EntityListHeader";
import type {
    MeetingsTab,
    MeetingsTabCounts,
    MeetingsViewMode,
} from "../adapters/meetingViewModel";

interface MeetingsHeaderProps {
    view: MeetingsViewMode;
    onViewChange: (view: MeetingsViewMode) => void;
    /** Hidden on the calendar, which shows every bucket at once. */
    showTabs: boolean;
    tab: MeetingsTab;
    onTabChange: (tab: MeetingsTab) => void;
    counts: MeetingsTabCounts;
    onRefresh: () => void;
    refreshing: boolean;
    onSchedule: () => void;
    canSchedule: boolean;
    /** The active-filter sentence band, when any filter is set. */
    filterSentence?: ReactNode;
    /** Whether the "next up" cards are showing, and how to flip that. */
    stripVisible: boolean;
    onToggleStrip: () => void;
    /** Badge on the Filters button. */
    filtersCount: number;
    onOpenFilters: () => void;
    filtersLabel: string;
}

const VIEW_OPTIONS: EntityListHeaderViewOption[] = [
    { value: "list", label: "List", icon: <Icon name="list" size={13} /> },
    {
        value: "calendar",
        label: "Calendar",
        icon: <Icon name="calendar" size={13} />,
    },
];

const TAB_LABELS: Array<{ value: MeetingsTab; label: string }> = [
    { value: "all", label: "All meetings" },
    { value: "upcoming", label: "Upcoming" },
    { value: "past", label: "Past" },
];

/**
 * Meetings' band of the shared `EntityListHeader`, so this page frames itself
 * the way Deals/Leads/Tasks do. The Upcoming/Past/Live tabs live in the
 * header's toolbar row — they are the list's primary filter, not a control
 * that belongs to the results below it.
 */
export default function MeetingsHeader({
    view,
    onViewChange,
    showTabs,
    tab,
    onTabChange,
    counts,
    onRefresh,
    refreshing,
    onSchedule,
    canSchedule,
    filterSentence,
    stripVisible,
    onToggleStrip,
    filtersCount,
    onOpenFilters,
    filtersLabel,
}: MeetingsHeaderProps) {
    const { td } = useTd();
    const { t } = useTranslation();

    return (
        <EntityListHeader
            title={t("app.meetings.my_meetings")}
            subtitle={td("Everything scheduled across your leads and deals.")}
            sticky
            viewOptions={VIEW_OPTIONS}
            viewValue={view}
            onViewChange={(next) => onViewChange(next as MeetingsViewMode)}
            actions={
                <>
                    <button
                        type="button"
                        className="dr-btn dr-btn-ghost"
                        onClick={onRefresh}
                        disabled={refreshing}
                    >
                        <Icon
                            name="refresh"
                            size={13}
                            className={refreshing ? "animate-spin" : undefined}
                        />
                        {td("Refresh")}
                    </button>
                    {canSchedule && (
                        <button
                            type="button"
                            className="dr-btn dr-btn-primary"
                            onClick={onSchedule}
                        >
                            <Icon name="plus" size={13} />
                            {t("app.meetings.actions.schedule")}
                        </button>
                    )}
                </>
            }
            filtersCount={filtersCount}
            onOpenFilters={onOpenFilters}
            filtersLabel={filtersLabel}
            toolbarLeft={
                showTabs ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Segmented<MeetingsTab>
                            value={tab}
                            onChange={onTabChange}
                            ariaLabel={td("Filter meetings")}
                            options={TAB_LABELS.map((option) => ({
                                value: option.value,
                                label: td(option.label),
                                count: counts[option.value],
                            }))}
                        />

                        {/* The cards above the list are a convenience, not part
                        of the results — so they get a plain toggle rather
                        than a place in the view switcher. */}
                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost"
                            onClick={onToggleStrip}
                            aria-pressed={stripVisible}
                        >
                            <Icon
                                name={stripVisible ? "eye-off" : "eye"}
                                size={13}
                            />
                            {stripVisible
                                ? td("Hide next up")
                                : td("Show next up")}
                        </button>
                    </div>
                ) : undefined
            }
            filterSentence={filterSentence}
        />
    );
}

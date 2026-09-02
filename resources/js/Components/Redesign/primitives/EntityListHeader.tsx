import type { ReactNode } from "react";
import { FilterOutlined } from "@ant-design/icons";
import {
    REDESIGN_TOKENS as T,
    REDESIGN_FONT_STACK,
} from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface EntityListHeaderViewOption {
    value: string;
    label: string;
    icon: ReactNode;
}

export interface FiltersButtonProps {
    count?: number;
    onClick: () => void;
    /** Defaults to the ad-hoc-translated "Filters". */
    label?: string;
    className?: string;
    /** Optional `data-tour` value — never hardcoded per entity. */
    tourTarget?: string;
}

/** The Filters icon-button-with-badge, shared so a page can place it
 * outside `EntityListHeader`'s own toolbar row when its layout calls for it
 * (e.g. inline with the primary actions instead of a second row). */
export function FiltersButton({
    count = 0,
    onClick,
    label,
    className = "dr-btn dr-btn-ghost",
    tourTarget,
}: FiltersButtonProps) {
    const { td } = useTd();
    return (
        <button
            type="button"
            className={className}
            onClick={onClick}
            {...(tourTarget ? { "data-tour": tourTarget } : {})}
        >
            <FilterOutlined style={{ fontSize: 13 }} />
            {label ?? td("Filters")}
            {count > 0 && (
                <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-full text-[11px] font-semibold"
                    style={{
                        background: T.BLUE,
                        color: T.WHITE,
                    }}
                >
                    {count}
                </span>
            )}
        </button>
    );
}

export interface EntityListHeaderProps {
    title: string;
    /**
     * Summary/stats line under the title (e.g. "106 active deals · £182,400
     * pipeline value"). Pass a `<Deferred>` node when the copy depends on
     * deferred counts. Omit when the entity has no equivalent metric.
     */
    subtitle?: ReactNode;
    viewOptions?: EntityListHeaderViewOption[];
    viewValue?: string;
    onViewChange?: (value: string) => void;
    /** Right-aligned buttons rendered after the view toggle (Import, Refresh, Add, ...). */
    actions?: ReactNode;
    /**
     * Optional controls rendered immediately before `actions` in the title
     * row (e.g. the Leads-only "Due this week" chip). Other lists omit this.
     */
    leadingActions?: ReactNode;
    /**
     * Ghost "Replay guide" in the title-row actions cluster. Omitted entirely
     * when undefined (not a no-op) — same rule as the deal/lead detail ⋮ menus.
     */
    onReplayGuide?: () => void;
    /** Parent should pass `t("….replay_menu_item")`. Falls back to "Replay guide". */
    replayGuideLabel?: string;
    /** Optional `data-tour` value on the Replay button — never hardcoded per entity. */
    replayTourTarget?: string;
    /**
     * Second row, left side — a pipeline selector, quick filters, whatever
     * the entity needs. The row itself is only rendered when this or
     * `onOpenFilters` is provided.
     */
    toolbarLeft?: ReactNode;
    /** Active filter count for the Filters button badge. */
    filtersCount?: number;
    /** Filters button is only rendered when this is provided. */
    onOpenFilters?: () => void;
    /** Defaults to the ad-hoc-translated "Filters". */
    filtersLabel?: string;
    /**
     * The page's `<ActiveFilterSentence>` (unmodified) — rendered in the
     * same quiet off-white band Tasks uses, so the three lists frame it
     * identically. Omitted (band not rendered) when not provided.
     */
    filterSentence?: ReactNode;
    maxWidth?: number;
    /** Sticks the band to the top of its scroll container. */
    sticky?: boolean;
    /** Optional `data-tour` on the title + subtitle column. */
    titleTourTarget?: string;
    /** Optional `data-tour` on the Table/Board (or equivalent) toggle. */
    viewToggleTourTarget?: string;
    /** Optional `data-tour` wrapping `toolbarLeft`. */
    toolbarLeftTourTarget?: string;
    /** Optional `data-tour` on the toolbar-row Filters button. */
    filtersTourTarget?: string;
    /** Optional `data-tour` on the active-filter sentence band. */
    filterSentenceTourTarget?: string;
}

/**
 * Title + stats + primary actions band, with an optional second toolbar
 * row (left-side content plus a Filters button). Styled after the Tasks
 * redesign header — shared across Tasks/Deals/Leads so the three lists
 * read as one visual system instead of three near-identical forks.
 */
export default function EntityListHeader({
    title,
    subtitle,
    viewOptions,
    viewValue,
    onViewChange,
    actions,
    leadingActions,
    onReplayGuide,
    replayGuideLabel,
    replayTourTarget,
    toolbarLeft,
    filtersCount = 0,
    onOpenFilters,
    filtersLabel,
    filterSentence,
    maxWidth = 1536,
    sticky = false,
    titleTourTarget,
    viewToggleTourTarget,
    toolbarLeftTourTarget,
    filtersTourTarget,
    filterSentenceTourTarget,
}: EntityListHeaderProps) {
    const { td } = useTd();
    const showViewToggle = Boolean(viewOptions?.length && onViewChange);
    const showToolbarRow = Boolean(toolbarLeft || onOpenFilters);

    return (
        <div
            style={{
                background: T.WHITE,
                borderBottom: `1px solid ${T.BORDER}`,
                ...(sticky
                    ? { position: "sticky" as const, top: 0, zIndex: 15 }
                    : {}),
            }}
        >
            <div
                className="mx-auto w-full px-6 pt-[18px] pb-4 space-y-4 max-w-screen-2xl"
                style={{ maxWidth, fontFamily: REDESIGN_FONT_STACK }}
            >
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div
                        className="flex flex-col gap-1"
                        {...(titleTourTarget
                            ? { "data-tour": titleTourTarget }
                            : {})}
                    >
                        <h1
                            className="m-0 font-bold"
                            style={{
                                fontSize: 21,
                                color: T.NAVY,
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {title}
                        </h1>
                        {subtitle ? (
                            <p
                                className="m-0"
                                style={{ fontSize: 15, color: T.TEXT_MUTED }}
                            >
                                {subtitle}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2.5">
                        {showViewToggle && (
                            <div
                                className="flex gap-0.5 p-0.5"
                                {...(viewToggleTourTarget
                                    ? { "data-tour": viewToggleTourTarget }
                                    : {})}
                                style={{
                                    background: T.BG,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 8,
                                }}
                            >
                                {viewOptions!.map((option) => {
                                    const active = viewValue === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() =>
                                                onViewChange!(option.value)
                                            }
                                            className="inline-flex items-center gap-1.5"
                                            style={{
                                                padding: "5px 10px",
                                                borderRadius: 6,
                                                border: "none",
                                                fontSize: 14,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                background: active
                                                    ? T.WHITE
                                                    : "transparent",
                                                color: active
                                                    ? T.NAVY
                                                    : T.TEXT_MUTED,
                                            }}
                                        >
                                            {option.icon}
                                            {td(option.label)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {onReplayGuide !== undefined && (
                            <button
                                type="button"
                                className="dr-btn dr-btn-ghost"
                                onClick={onReplayGuide}
                                {...(replayTourTarget
                                    ? { "data-tour": replayTourTarget }
                                    : {})}
                            >
                                {replayGuideLabel ?? td("Replay guide")}
                            </button>
                        )}
                        {leadingActions}
                        {actions}
                    </div>
                </div>

                {showToolbarRow && (
                    <div className="flex flex-wrap items-center gap-2.5">
                        {toolbarLeftTourTarget && toolbarLeft ? (
                            <div data-tour={toolbarLeftTourTarget}>
                                {toolbarLeft}
                            </div>
                        ) : (
                            toolbarLeft
                        )}
                        {onOpenFilters && (
                            <FiltersButton
                                count={filtersCount}
                                onClick={onOpenFilters}
                                label={filtersLabel}
                                className="dr-btn dr-btn-ghost ml-auto"
                                tourTarget={filtersTourTarget}
                            />
                        )}
                    </div>
                )}
            </div>

            {filterSentence && (
                <div
                    style={{
                        background: T.SURFACE_2,
                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                    }}
                    {...(filterSentenceTourTarget
                        ? { "data-tour": filterSentenceTourTarget }
                        : {})}
                >
                    <div
                        className="mx-auto w-full px-6"
                        style={{ maxWidth, fontFamily: REDESIGN_FONT_STACK }}
                    >
                        {filterSentence}
                    </div>
                </div>
            )}
        </div>
    );
}

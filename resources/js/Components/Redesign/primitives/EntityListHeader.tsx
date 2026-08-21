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

export interface EntityListHeaderProps {
    title: string;
    /**
     * Summary/stats line under the title (e.g. "106 active deals · £182,400
     * pipeline value"). Omit — don't pass a placeholder — when the entity
     * has no equivalent metric to show; the line is skipped entirely rather
     * than rendering an empty or fabricated value.
     */
    subtitle?: string | null;
    viewOptions?: EntityListHeaderViewOption[];
    viewValue?: string;
    onViewChange?: (value: string) => void;
    /** Right-aligned buttons rendered after the view toggle (Import, Refresh, Add, ...). */
    actions?: ReactNode;
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
    toolbarLeft,
    filtersCount = 0,
    onOpenFilters,
    filtersLabel,
    filterSentence,
    maxWidth = 1440,
    sticky = false,
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
                className="mx-auto w-full px-6 pt-[18px] pb-4 space-y-4"
                style={{ maxWidth, fontFamily: REDESIGN_FONT_STACK }}
            >
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="flex flex-col gap-1">
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
                        {actions}
                    </div>
                </div>

                {showToolbarRow && (
                    <div className="flex flex-wrap items-center gap-2.5">
                        {toolbarLeft}
                        {onOpenFilters && (
                            <button
                                type="button"
                                className="dr-btn dr-btn-ghost ml-auto"
                                onClick={onOpenFilters}
                            >
                                <FilterOutlined style={{ fontSize: 13 }} />
                                {filtersLabel ?? td("Filters")}
                                {filtersCount > 0 && (
                                    <span
                                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-full text-[11px] font-semibold"
                                        style={{
                                            background: T.BLUE,
                                            color: T.WHITE,
                                        }}
                                    >
                                        {filtersCount}
                                    </span>
                                )}
                            </button>
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

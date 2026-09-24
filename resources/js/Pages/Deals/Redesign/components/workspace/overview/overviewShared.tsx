import { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

interface OverviewColumnHeaderProps {
    icon: string;
    iconBg: string;
    iconColor: string;
    title: string;
    count: number;
    addLabel?: string;
    onAdd?: () => void;
    addActive?: boolean;
}

export function OverviewColumnHeader({
    icon,
    iconBg,
    iconColor,
    title,
    count,
    addLabel = "+ Add",
    onAdd,
    addActive,
}: OverviewColumnHeaderProps) {
    const { t } = useTranslation();
    return (
        <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center">
            <span />
            <div className="flex items-center justify-center gap-2 whitespace-nowrap text-center text-[15px] font-semibold text-dr-text">
                <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: iconBg }}
                >
                    <Icon name={icon} size={13} color={iconColor} />
                </span>
                {title}
                <span className="font-medium text-dr-text-hint">· {count}</span>
            </div>
            <div className="flex justify-end">
                {onAdd && (
                    <Button variant="ghost" size="sm" onClick={onAdd}>
                        {addActive ? t("pages.deals.common.cancel") : addLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}

export function OverviewEmptyMini({
    icon,
    label,
}: {
    icon: string;
    label: string;
}) {
    return (
        <div className="rounded-lg border border-dr-border bg-white px-3.5 py-[26px] text-center text-dr-text-hint">
            <Icon
                name={icon}
                size={26}
                color={T.TEXT_HINT}
                className="mx-auto mb-1.5 opacity-50"
            />
            <div className="text-xs">{label}</div>
        </div>
    );
}

export function OverviewColumnShell({
    borderSide,
    children,
}: {
    borderSide: "left" | "middle" | "right";
    children: ReactNode;
}) {
    const padding =
        borderSide === "left"
            ? "pr-4"
            : borderSide === "middle"
              ? "px-4"
              : "pl-4";
    const border =
        borderSide === "right"
            ? ""
            : "border-r border-dr-border";

    return (
        <div className={`${padding} ${border}`}>
            {children}
        </div>
    );
}

export function OverviewViewLink({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            className="text-[12px] text-dr-blue hover:text-dr-blue-hover"
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            {label}
        </button>
    );
}

/** Pulse placeholder for a single overview column while deferred props load (C4). */
export function OverviewColumnPendingSkeleton() {
    return (
        <div className="space-y-3">
            <div className="mx-auto h-5 w-36 animate-pulse rounded bg-dr-skeleton" />
            {Array.from({ length: 3 }).map((_, index) => (
                <div
                    key={index}
                    className="rounded-lg border border-dr-border bg-white px-3.5 py-3"
                >
                    <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-dr-skeleton" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-dr-skeleton" />
                </div>
            ))}
        </div>
    );
}

/**
 * Deals overview skeleton. Mirrors the loaded WorkspaceOverviewTab exactly —
 * same `dr-overview`/`dr-ov-col` columns, and the real column titles are shown
 * (not hidden behind gray bars) so the user knows which column is which while
 * data resolves. Only the card rows are skeletoned, and the layout matches the
 * loaded state so nothing reflows/pops when data arrives.
 */
export function OverviewDeferredSkeleton() {
    const { t } = useTranslation();
    const columns = [
        t("pages.deals.tabs.notes"),
        t("pages.deals.workspace.overview.open_tasks_col"),
        t("pages.deals.workspace.overview.upcoming_meetings_col"),
    ];
    return (
        <div className="dr-overview">
            {columns.map((title) => (
                <div key={title} className="dr-ov-col">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span className="dr-label">{title}</span>
                    </div>
                    <div className="dr-ov-col-body space-y-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div
                                key={index}
                                className="rounded-[10px] border border-dr-border bg-white px-3 py-2.5"
                            >
                                <div className="mb-2 h-3.5 w-2/3 animate-pulse rounded bg-dr-skeleton" />
                                <div className="h-3 w-2/5 animate-pulse rounded bg-dr-skeleton" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Small card skeleton for context-rail deferred sections (re-exported and
 * used by the Leads drawer's overviewShared barrel). */
export function RailCardDeferredSkeleton() {
    return (
        <div className="mb-3 animate-pulse rounded-[10px] border border-dr-border bg-white p-3.5">
            <div className="mb-3 h-4 w-1/2 rounded bg-dr-skeleton" />
            <div className="mb-2 h-3 w-full rounded bg-dr-skeleton" />
            <div className="h-3 w-2/3 rounded bg-dr-skeleton" />
        </div>
    );
}

/** Compact list skeleton for deferred tab panes (notes, tasks, files, etc.). */
export function TabDeferredSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-2.5">
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className="animate-pulse rounded-lg border border-dr-border bg-white px-3.5 py-3.5"
                >
                    <div className="mb-2 h-4 w-2/3 rounded bg-dr-skeleton" />
                    <div className="h-3 w-1/3 rounded bg-dr-skeleton" />
                </div>
            ))}
        </div>
    );
}


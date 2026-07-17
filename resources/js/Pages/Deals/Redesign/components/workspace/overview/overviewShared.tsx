import { ReactNode } from "react";
import DealButton from "../../primitives/DealButton";
import DealIcon from "../../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

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
    return (
        <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center">
            <span />
            <div className="flex items-center justify-center gap-2 whitespace-nowrap text-center text-[15px] font-semibold text-[#1a1f2e]">
                <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: iconBg }}
                >
                    <DealIcon name={icon} size={13} color={iconColor} />
                </span>
                {title}
                <span className="font-medium text-[#9ca3af]">· {count}</span>
            </div>
            <div className="flex justify-end">
                {onAdd && (
                    <DealButton variant="ghost" size="sm" onClick={onAdd}>
                        {addActive ? "Cancel" : addLabel}
                    </DealButton>
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
        <div className="rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-[26px] text-center text-[#9ca3af]">
            <DealIcon
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
            : "border-r border-[#e2e5ea]";

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
            className="text-[11px] text-[#1a6bb5] hover:text-[#145890]"
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
            <div className="mx-auto h-5 w-36 animate-pulse rounded bg-[#eef1f5]" />
            {Array.from({ length: 3 }).map((_, index) => (
                <div
                    key={index}
                    className="rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3"
                >
                    <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-[#eef1f5]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-[#eef1f5]" />
                </div>
            ))}
        </div>
    );
}

/** Three-column overview skeleton while notes/tasks/meetings deferred props resolve. */
export function OverviewDeferredSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-0 xl:grid-cols-3">
            <OverviewColumnShell borderSide="left">
                <OverviewColumnPendingSkeleton />
            </OverviewColumnShell>
            <OverviewColumnShell borderSide="middle">
                <OverviewColumnPendingSkeleton />
            </OverviewColumnShell>
            <OverviewColumnShell borderSide="right">
                <OverviewColumnPendingSkeleton />
            </OverviewColumnShell>
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
                    className="animate-pulse rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3.5"
                >
                    <div className="mb-2 h-4 w-2/3 rounded bg-[#eef1f5]" />
                    <div className="h-3 w-1/3 rounded bg-[#eef1f5]" />
                </div>
            ))}
        </div>
    );
}

/** Small card skeleton for context-rail deferred sections. */
export function RailCardDeferredSkeleton() {
    return (
        <div className="mb-3 animate-pulse rounded-[10px] border border-[#e2e5ea] bg-white p-3.5">
            <div className="mb-3 h-4 w-1/2 rounded bg-[#eef1f5]" />
            <div className="mb-2 h-3 w-full rounded bg-[#eef1f5]" />
            <div className="h-3 w-2/3 rounded bg-[#eef1f5]" />
        </div>
    );
}

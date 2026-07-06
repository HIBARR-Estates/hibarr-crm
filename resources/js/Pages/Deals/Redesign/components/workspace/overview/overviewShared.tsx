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
                    <DealButton
                        variant="ghost"
                        onClick={onAdd}
                        style={{ fontSize: 11, padding: "3px 8px" }}
                    >
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

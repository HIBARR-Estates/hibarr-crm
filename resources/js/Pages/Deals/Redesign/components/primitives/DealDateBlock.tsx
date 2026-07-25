import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealDateBlockProps {
    monthLabel: string;
    dayLabel: string | number;
    /** Past/completed items get the muted treatment instead of the accent one. */
    muted?: boolean;
    onClick?: () => void;
}

/**
 * The "OCT / 23" stacked calendar block. Was hand-rolled separately in
 * WorkspaceOverviewTab and WorkspaceMeetingsTab with different width/radius/
 * border/leading, so the same kind of date read as two different components
 * on the same page — one shared primitive now backs both.
 */
export default function DealDateBlock({
    monthLabel,
    dayLabel,
    muted = false,
    onClick,
}: DealDateBlockProps) {
    const Tag = onClick ? "button" : "div";
    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={`w-12 shrink-0 self-start rounded-lg border px-1.5 py-2 text-center ${
                onClick ? "cursor-pointer" : ""
            }`}
            style={{
                background: muted ? T.SURFACE_2 : T.BLUE_LIGHT,
                borderColor: muted ? T.BORDER : T.BLUE_MID,
            }}
        >
            <span
                className="block text-[12px] uppercase"
                style={{ color: T.TEXT_MUTED }}
            >
                {monthLabel}
            </span>
            <span
                className="block text-base font-bold leading-tight"
                style={{ color: muted ? T.TEXT_MUTED : T.BLUE_DARK }}
            >
                {dayLabel}
            </span>
        </Tag>
    );
}

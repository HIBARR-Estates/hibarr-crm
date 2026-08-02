import { REDESIGN_TOKENS as T } from "../tokens";

interface DateBlockProps {
    monthLabel: string;
    dayLabel: string | number;
    /** Past/completed items get the muted treatment instead of the accent one. */
    muted?: boolean;
    onClick?: () => void;
}

/** Stacked "OCT / 23" calendar tile. */
export default function DateBlock({
    monthLabel,
    dayLabel,
    muted = false,
    onClick,
}: DateBlockProps) {
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

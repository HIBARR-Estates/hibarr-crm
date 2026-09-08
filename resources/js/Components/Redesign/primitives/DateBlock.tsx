import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T, REDESIGN_TYPE } from "../tokens";

interface DateBlockProps {
    monthLabel: string;
    dayLabel: string | number;
    /**
     * Adds a third line under the day and switches to the taller tile
     * (larger day numeral, LG radius) the Meetings list uses. Omit for the
     * compact two-line tile the Deal/Lead cards render.
     */
    weekdayLabel?: string;
    /** Past/completed items get the muted treatment instead of the accent one. */
    muted?: boolean;
    onClick?: () => void;
}

/** Stacked "OCT / 23" calendar tile, optionally with a "Thu" line. */
export default function DateBlock({
    monthLabel,
    dayLabel,
    weekdayLabel,
    muted = false,
    onClick,
}: DateBlockProps) {
    const Tag = onClick ? "button" : "div";
    const tall = weekdayLabel !== undefined;
    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={`w-12 shrink-0 self-start overflow-hidden border text-center ${
                tall ? "pt-1 pb-[5px]" : "px-1.5 py-2"
            } ${onClick ? "cursor-pointer" : ""}`}
            style={{
                background: muted ? T.SURFACE_2 : T.BLUE_LIGHT,
                borderColor: muted ? T.BORDER : T.BLUE_MID,
                borderRadius: tall ? R.LG : R.MD,
            }}
        >
            <span
                className={`block text-[12px] uppercase${tall ? " font-bold tracking-[0.05em]" : ""}`}
                style={{
                    color: muted || !tall ? T.TEXT_MUTED : T.BLUE_DARK,
                }}
            >
                {monthLabel}
            </span>
            <span
                className="block font-bold leading-tight"
                style={{
                    fontSize: tall ? REDESIGN_TYPE.DISPLAY : REDESIGN_TYPE.HEADING,
                    color: muted ? T.TEXT_MUTED : tall ? T.NAVY : T.BLUE_DARK,
                }}
            >
                {dayLabel}
            </span>
            {tall && (
                <span
                    className="block text-[12px]"
                    style={{ color: T.TEXT_MUTED }}
                >
                    {weekdayLabel}
                </span>
            )}
        </Tag>
    );
}

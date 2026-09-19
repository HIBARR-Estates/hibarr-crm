import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

/**
 * Month-grid placeholder while the deferred `calendarMeetings` prop resolves.
 * Same chrome and cell height as the real grid so nothing reflows on arrival.
 */
export default function MeetingsCalendarSkeleton() {
    return (
        <div
            className="overflow-hidden"
            style={{
                background: T.WHITE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
            }}
        >
            <div
                className="flex items-center justify-between gap-4 px-[18px] py-3.5"
                style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
            >
                <div className="h-6 w-40 animate-pulse rounded bg-[#eef1f5]" />
                <div className="h-6 w-56 animate-pulse rounded bg-[#eef1f5]" />
            </div>
            {/* Same weekday row the real grid renders above its cells — left
                out, the skeleton would be one row shorter than the calendar
                it's standing in for, and swapping the two would visibly jump. */}
            <div className="grid grid-cols-7">
                {Array.from({ length: 7 }).map((_, index) => (
                    <div
                        key={index}
                        className="px-3 py-3"
                        style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                    >
                        <div className="h-[13px] w-8 animate-pulse rounded bg-[#eef1f5]" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, index) => (
                    <div
                        key={index}
                        className="min-h-[152px] p-2"
                        style={{
                            borderRight: `1px solid ${T.BORDER_SOFT}`,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <div className="h-[22px] w-[22px] animate-pulse rounded-full bg-[#eef1f5]" />
                    </div>
                ))}
            </div>
        </div>
    );
}

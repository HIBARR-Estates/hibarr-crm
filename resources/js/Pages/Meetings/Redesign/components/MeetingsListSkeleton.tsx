import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

/**
 * The list's place while its data is on the way.
 *
 * The page opens on the calendar and only fetches the list when it is
 * switched to, so the first look at the list has nothing to draw yet. Rows of
 * the table's own height, inside its own frame, so it fills in rather than
 * jumps.
 */
export default function MeetingsListSkeleton() {
    return (
        <div
            aria-busy="true"
            className="overflow-hidden"
            style={{
                background: T.WHITE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
            }}
        >
            {[0, 1, 2, 3, 4, 5].map((row) => (
                <div
                    key={row}
                    className="flex items-center gap-4 px-4"
                    style={{
                        height: 84,
                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    <div className="h-4 w-4 animate-pulse rounded bg-dr-skeleton" />
                    <div className="h-10 w-12 animate-pulse rounded bg-dr-skeleton" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-2/5 animate-pulse rounded bg-dr-skeleton" />
                        <div className="h-3 w-1/4 animate-pulse rounded bg-dr-skeleton" />
                    </div>
                    <div className="hidden h-5 w-20 animate-pulse rounded-full bg-dr-skeleton md:block" />
                </div>
            ))}
        </div>
    );
}

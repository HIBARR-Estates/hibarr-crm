import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

export interface CallSummaryTile {
    label: string;
    value: string;
    /** Draws the eye to a number that needs attention (missed, unlinked). */
    tone?: "default" | "danger" | "warning";
}

/** A row of label/value tiles above a call log (lead Calls tab, Calls page). */
export default function CallSummaryTiles({ tiles }: { tiles: CallSummaryTile[] }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
            }}
        >
            {tiles.map((tile) => (
                <div
                    key={tile.label}
                    style={{
                        background: T.SURFACE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 10,
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                    }}
                >
                    <span className="dr-label" style={{ color: T.TEXT_MUTED }}>
                        {tile.label}
                    </span>
                    <span
                        style={{
                            fontSize: 19,
                            fontWeight: 700,
                            color:
                                tile.tone === "danger"
                                    ? T.RED
                                    : tile.tone === "warning"
                                      ? T.AMBER
                                      : T.NAVY,
                        }}
                    >
                        {tile.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

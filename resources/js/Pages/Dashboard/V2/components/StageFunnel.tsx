import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

type Tone = "blue" | "green" | "navy";

export interface StageFunnelDatum {
    key: string | number;
    /** English source string or a stage name — translated at render. */
    label: string;
    count: number;
    tone?: Tone;
    /** How long the deals currently here have been here. */
    openMedianDays?: number | null;
    /** Historic transit time; null under three samples. */
    medianDays?: number | null;
    samples?: number;
}

interface StageFunnelProps {
    data: StageFunnelDatum[];
    /** Label column width. Stage names are longer than funnel step names. */
    labelWidth?: number;
    emptyMessage?: string;
}

const TONES: Record<Tone, string> = {
    blue: T.BLUE,
    green: T.GREEN,
    navy: T.NAVY,
};

/**
 * Horizontal count bars — the agent's pipeline and the partner's referral
 * funnel are the same shape, so they share this.
 *
 * Bar width is relative to the largest row, not the first. Pipeline stages
 * aren't strictly sequential in every pipeline here, so anchoring on the first
 * row would render most bars as slivers.
 */
export default function StageFunnel({
    data,
    labelWidth = 112,
    emptyMessage = "No stages to show",
}: StageFunnelProps) {
    const { td } = useTd();

    if (!data.length) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_HINT }}>
                {td(emptyMessage)}
            </p>
        );
    }

    const max = Math.max(...data.map((row) => row.count), 1);
    // Only claim a dwell column when at least one stage can fill it.
    const showDwell = data.some(
        (row) => row.openMedianDays !== null && row.openMedianDays !== undefined,
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {showDwell && (
                <div
                    className="dv2-eyebrow"
                    style={{ textAlign: "right", fontSize: 11 }}
                >
                    {td("Time in stage")}
                </div>
            )}
            {data.map((row) => {
                const empty = row.count === 0;

                return (
                    <div
                        key={row.key}
                        style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                        <div
                            style={{
                                width: labelWidth,
                                flex: "none",
                                fontSize: 13,
                                color: empty ? T.TEXT_HINT : T.TEXT_MUTED,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                            title={td(row.label)}
                        >
                            {td(row.label)}
                        </div>

                        <div
                            style={{
                                flex: 1,
                                height: 20,
                                background: "#f2f4f7",
                                borderRadius: 5,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    height: 20,
                                    // 4% floor so a stage holding one deal is
                                    // still visible next to a stage holding 60.
                                    width: `${empty ? 0 : Math.max((row.count / max) * 100, 4)}%`,
                                    background: TONES[row.tone ?? "blue"],
                                    borderRadius: 5,
                                }}
                            />
                        </div>

                        <div
                            style={{
                                width: 28,
                                flex: "none",
                                textAlign: "right",
                                fontSize: 13,
                                fontWeight: empty ? 400 : 600,
                                color: empty ? T.TEXT_HINT : T.TEXT,
                            }}
                        >
                            {row.count}
                        </div>

                        {showDwell && (
                            <div
                                style={{
                                    width: 46,
                                    flex: "none",
                                    textAlign: "right",
                                    fontSize: 12,
                                    color: T.TEXT_HINT,
                                }}
                                title={
                                    row.medianDays !== null &&
                                    row.medianDays !== undefined
                                        ? `${td("Typically")} ${row.medianDays}d ${td("based on")} ${row.samples} ${td("past moves")}`
                                        : td(
                                              "Not enough past stage moves to give a typical duration",
                                          )
                                }
                            >
                                {row.openMedianDays === null ||
                                row.openMedianDays === undefined
                                    ? ""
                                    : `${row.openMedianDays}d`}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

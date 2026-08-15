import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PartnerTrendPoint } from "../types";

const HEIGHT = 140;

/**
 * Referrals submitted against referrals completed, by month.
 *
 * Two series rather than a conversion rate per month: completions lag
 * submissions by months here, so a monthly ratio would read as a collapse
 * every time the partner has a strong intake month.
 */
export default function PartnerTrendChart({
    data,
}: {
    data: PartnerTrendPoint[];
}) {
    const { td } = useTd();

    const max = Math.max(
        ...data.map((point) => Math.max(point.submitted, point.completed)),
        1,
    );
    // Round the axis up to something with readable gridlines.
    const ceiling = Math.max(4, Math.ceil(max / 4) * 4);
    const ticks = [4, 3, 2, 1, 0].map((step) => (ceiling / 4) * step);

    if (!data.some((point) => point.submitted || point.completed)) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {td("No referrals recorded in the last 12 months.")}
            </p>
        );
    }

    return (
        <div>
            <div style={{ display: "flex", gap: 12 }}>
                <div
                    aria-hidden
                    style={{
                        width: 18,
                        height: HEIGHT,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: T.TEXT_HINT,
                        textAlign: "right",
                    }}
                >
                    {ticks.map((tick) => (
                        <span key={tick}>{tick}</span>
                    ))}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ position: "relative", height: HEIGHT }}>
                        {[0, 25, 50, 75].map((offset) => (
                            <div
                                key={offset}
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    top: `${offset}%`,
                                    height: 1,
                                    background: T.BORDER_SOFT,
                                }}
                            />
                        ))}
                        <div
                            aria-hidden
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: 0,
                                height: 1,
                                background: T.NAVY_MID,
                            }}
                        />

                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "grid",
                                gridTemplateColumns: `repeat(${data.length}, 1fr)`,
                                columnGap: 10,
                                alignItems: "end",
                            }}
                        >
                            {data.map((point, index) => (
                                <div
                                    key={point.period}
                                    style={{
                                        display: "flex",
                                        gap: 3,
                                        alignItems: "flex-end",
                                    }}
                                    title={`${point.label}: ${point.submitted} ${td("submitted")}, ${point.completed} ${td("completed")}`}
                                >
                                    <Bar
                                        value={point.submitted}
                                        ceiling={ceiling}
                                        // The current month is partial — shown
                                        // lighter so it doesn't read as a drop.
                                        color={
                                            index === data.length - 1
                                                ? "#7fb0dd"
                                                : T.BLUE
                                        }
                                    />
                                    <Bar
                                        value={point.completed}
                                        ceiling={ceiling}
                                        color={T.GREEN}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${data.length}, 1fr)`,
                            columnGap: 10,
                            marginTop: 8,
                        }}
                    >
                        {data.map((point, index) => (
                            <div
                                key={point.period}
                                style={{
                                    textAlign: "center",
                                    fontSize: 12,
                                    color:
                                        index === data.length - 1
                                            ? T.NAVY
                                            : T.TEXT_HINT,
                                    fontWeight:
                                        index === data.length - 1 ? 600 : 400,
                                }}
                            >
                                {point.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Bar({
    value,
    ceiling,
    color,
}: {
    value: number;
    ceiling: number;
    color: string;
}) {
    return (
        <div
            style={{
                flex: 1,
                height: `${(value / ceiling) * 100}%`,
                minHeight: 2,
                background: value > 0 ? color : "#e7eaf0",
                borderRadius: 2,
            }}
        />
    );
}

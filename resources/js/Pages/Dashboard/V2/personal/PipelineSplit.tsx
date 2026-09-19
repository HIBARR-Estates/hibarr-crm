import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PipelineRow } from "./types";
import { dominantTotal } from "./format";

interface PipelineSplitProps {
    pipelines: PipelineRow[];
    /** Opens the deal list. */
    dealsHref: string;
}

/** The one bar on this page: each pipeline's value against the largest. */
function barColour(share: number): string {
    if (share > 0.8) return T.NAVY;

    return share > 0.6 ? T.BLUE : "#7ba7d4";
}

/**
 * Open deals grouped by pipeline, ranked by deal count — count, value and how
 * many have gone quiet.
 *
 * Grouped by pipeline rather than stage on purpose: the pipelines carry
 * different stage sets with no shared ordinal, so a single cross-pipeline
 * funnel would stack unlike things.
 *
 * Ranked and bar-widthed by deal count rather than value: pipelines can be
 * quoted in different currencies with no maintained exchange rate between
 * them, so their raw totals aren't comparable. Deal count is currency-agnostic
 * and safe to compare. Rows arrive from the server pre-sorted the same way, so
 * the longest bar is always on top and the rest read relative to it at a
 * glance.
 */
export default function PipelineSplit({
    pipelines,
    dealsHref,
}: PipelineSplitProps) {
    const { td } = useTd();

    if (!pipelines.length) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "20px 0 4px",
                }}
            >
                <div
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                        background: T.GRAY,
                        border: `1px solid ${T.BORDER}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <svg
                        width={18}
                        height={18}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.TEXT_HINT}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        style={{ display: "block" }}
                    >
                        <path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                </div>
                <p
                    style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: T.NAVY,
                    }}
                >
                    {td("No open deals")}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: T.TEXT_MUTED }}>
                    {td(
                        "Deals appear here per pipeline as soon as you convert a lead. Won and lost deals are never counted.",
                    )}
                </p>
            </div>
        );
    }

    const largest = Math.max(
        ...pipelines.map((pipeline) => pipeline.deal_count),
        1,
    );

    return (
        <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {pipelines.map((pipeline) => {
                    // Empty when nothing in the pipeline carries a currency the
                    // server could name — the row then shows the count alone
                    // rather than a figure with no unit on it.
                    const hasValue = pipeline.totals.length > 0;
                    const { label, rest } = dominantTotal(pipeline.totals);
                    const share = pipeline.deal_count / largest;

                    return (
                        <div key={pipeline.id}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: 8,
                                    fontSize: 12.5,
                                    color: T.TEXT_MUTED,
                                }}
                            >
                                <span
                                    style={{ fontWeight: 600, color: T.TEXT }}
                                >
                                    {pipeline.name}
                                </span>
                                <span
                                    style={{
                                        marginLeft: "auto",
                                        fontWeight: 600,
                                        color: T.TEXT,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {pipeline.deal_count}{" "}
                                    {pipeline.deal_count === 1
                                        ? td("deal")
                                        : td("deals")}
                                </span>
                                {hasValue && (
                                    <>
                                        <span>·</span>
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                color: T.NAVY,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {label}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div
                                style={{
                                    height: 8,
                                    borderRadius: 999,
                                    background: T.BORDER_SOFT,
                                    marginTop: 5,
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        width: `${Math.max(share * 100, 2)}%`,
                                        height: "100%",
                                        background: barColour(share),
                                    }}
                                />
                            </div>

                            <div
                                style={{
                                    marginTop: 5,
                                    fontSize: 12,
                                    color: T.TEXT_HINT,
                                }}
                            >
                                {pipeline.idle_count
                                    ? `${pipeline.idle_count} ${td("with no activity in 7 days")}`
                                    : td("all touched in the last 7 days")}
                                {rest ? ` · ${rest}` : ""}
                            </div>
                        </div>
                    );
                })}
            </div>

            <p
                style={{
                    margin: "14px 0 0",
                    paddingTop: 12,
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: T.TEXT_MUTED,
                }}
            >
                {td(
                    "Ranked by deal count, highest first. Currencies are never converted or combined.",
                )}{" "}
                <a href={dealsHref} style={{ fontWeight: 600 }}>
                    {td("Open the deal list")}
                </a>
            </p>
        </div>
    );
}

import { Fragment, type ReactNode } from "react";
import { Link } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { LifecycleFunnel as FunnelData } from "../types";

const GRID = "minmax(110px, 1fr) 2fr 58px 92px 78px";

/**
 * Lead created → contacted → met → deal → won, with the drop between each.
 *
 * Not the pipeline-stage funnel: stage transitions live in `deal_histories`
 * but are barely written, so per-stage timing would be invented. These five
 * steps each rest on a timestamp that is actually populated.
 *
 * The steps are not strictly nested — a deal can be created without a meeting
 * ever having been logged — so bars are scaled to the largest step rather than
 * to the first, and the caveat is stated in the panel.
 *
 * In-betweens and counts link to the list that owns that object — leads,
 * meetings or deals — using that page's existing filters, not a dashboard-only
 * query param.
 */
export default function LifecycleFunnel({ data }: { data: FunnelData }) {
    const { td } = useTd();

    const max = Math.max(...data.steps.map((step) => step.count), 1);

    return (
        <div className="dv2-scroll-x">
            <div style={{ minWidth: 520 }}>
                <div
                    className="dv2-eyebrow"
                    style={{
                        display: "grid",
                        gridTemplateColumns: GRID,
                        columnGap: 12,
                        paddingBottom: 9,
                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    <div>{td("Stage", { source: "en" })}</div>
                    <div>{td("Volume", { source: "en" })}</div>
                    <div style={{ textAlign: "right" }}>
                        {td("Count", { source: "en" })}
                    </div>
                    <div style={{ textAlign: "right" }}>
                        {td("To next", { source: "en" })}
                    </div>
                    <div style={{ textAlign: "right" }}>
                        {td("Median", { source: "en" })}
                    </div>
                </div>

                {data.steps.map((step, index) => {
                    const isLast = index === data.steps.length - 1;
                    const leaking = step.to_next !== null && step.to_next < 34;
                    const stepHref =
                        step.count > 0 ? stepListHref(data, step.key) : null;
                    const dropHref =
                        step.dropped && step.drop_label
                            ? dropListHref(data, step.key)
                            : null;

                    return (
                        <Fragment key={step.key}>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: GRID,
                                    columnGap: 12,
                                    alignItems: "center",
                                    padding: "10px 0",
                                    fontSize: 14,
                                }}
                            >
                                <div>{td(step.label, { source: "en" })}</div>

                                <div
                                    style={{
                                        height: 20,
                                        background: "#f2f4f7",
                                        borderRadius: 4,
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: 20,
                                            width: `${step.count === 0 ? 0 : Math.max((step.count / max) * 100, 3)}%`,
                                            background: isLast
                                                ? T.GREEN
                                                : T.BLUE,
                                            borderRadius: 4,
                                        }}
                                    />
                                </div>

                                <div
                                    style={{
                                        textAlign: "right",
                                        fontWeight: 600,
                                    }}
                                >
                                    {stepHref ? (
                                        <FunnelLink href={stepHref}>
                                            {step.count}
                                        </FunnelLink>
                                    ) : (
                                        step.count
                                    )}
                                </div>

                                <div
                                    style={{
                                        textAlign: "right",
                                        color: leaking ? T.RED : T.TEXT_MUTED,
                                        fontWeight: leaking ? 600 : 400,
                                    }}
                                >
                                    {step.to_next === null
                                        ? "—"
                                        : `${step.to_next}%`}
                                </div>

                                <div
                                    style={{
                                        textAlign: "right",
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {step.median_days === null
                                        ? "—"
                                        : `${step.median_days}d`}
                                </div>
                            </div>

                            {!!step.dropped && step.drop_label && (
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: GRID,
                                        columnGap: 12,
                                    }}
                                >
                                    <div />
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "2px 0",
                                        }}
                                    >
                                        <span
                                            aria-hidden
                                            style={{
                                                width: 1,
                                                height: 14,
                                                background: T.BORDER,
                                                marginLeft: 6,
                                            }}
                                        />
                                        {dropHref ? (
                                            <FunnelLink
                                                href={dropHref}
                                                tone={
                                                    leaking ? T.RED : T.TEXT_HINT
                                                }
                                            >
                                                {step.dropped}{" "}
                                                {td(step.drop_label, {
                                                    source: "en",
                                                })}
                                            </FunnelLink>
                                        ) : (
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    color: leaking
                                                        ? T.RED
                                                        : T.TEXT_HINT,
                                                }}
                                            >
                                                {step.dropped}{" "}
                                                {td(step.drop_label, {
                                                    source: "en",
                                                })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
}

function leadListHref(
    data: FunnelData,
    extra: Record<string, string> = {},
): string {
    return route("lead-contact.index", {
        start_date: data.from,
        end_date: data.to,
        ...extra,
    });
}

function dealListHref(extra: Record<string, string> = {}): string {
    return route("deals.index", {
        lead_pipeline_id: "all",
        ...extra,
    });
}

function meetingListHref(data: FunnelData): string {
    return route("meetings.index", {
        date_from: data.from,
        date_to: data.to,
    });
}

function stepListHref(data: FunnelData, key: string): string | null {
    switch (key) {
        case "created":
            return leadListHref(data);
        case "contacted":
            return leadListHref(data, { contact_status: "contacted" });
        case "met":
            return meetingListHref(data);
        case "deal":
            return dealListHref({
                start_date: data.from,
                end_date: data.to,
            });
        case "won":
            return dealListHref({
                outcome_status: "won",
                start_date: data.from,
                end_date: data.to,
            });
        default:
            return null;
    }
}

function dropListHref(data: FunnelData, stepKey: string): string | null {
    switch (stepKey) {
        case "created":
            return leadListHref(data, { contact_status: "uncontacted" });
        case "contacted":
            return leadListHref(data, { contact_status: "contacted" });
        case "met":
            return meetingListHref(data);
        case "deal":
            return dealListHref({
                outcome_status: "open,lost",
                start_date: data.from,
                end_date: data.to,
            });
        default:
            return null;
    }
}

function FunnelLink({
    href,
    children,
    tone,
}: {
    href: string;
    children: ReactNode;
    tone?: string;
}) {
    return (
        <Link
            href={href}
            className="dv2-metric-link"
            data-tone={tone === T.RED ? "danger" : undefined}
        >
            {children}
        </Link>
    );
}

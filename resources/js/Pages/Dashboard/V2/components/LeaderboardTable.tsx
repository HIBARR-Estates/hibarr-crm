import {
    Avatar,
    REDESIGN_TOKENS as T,
    initialsFromName,
} from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TeamAgents, TeamAgentRow } from "../types";

const GRID = "minmax(170px, 1.6fr) .7fr .8fr 1.2fr .8fr .8fr .7fr minmax(150px, 1.5fr)";

/**
 * Per-agent detail — the coaching surface.
 *
 * The contact-rate bar carries a marker at the team median, because a number
 * on its own can't tell a manager whether 75% is the problem or the baseline.
 * Missing values render as "—": an agent with no new leads has no contact rate,
 * which is not the same as a 0% one.
 */
export default function LeaderboardTable({
    data,
    currentUserId,
}: {
    data: TeamAgents;
    currentUserId?: number;
}) {
    const { td } = useTd();

    if (!data.rows.length) {
        return (
            <div style={{ padding: 18 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {td("No agents report to you yet")}
                </p>
                <p
                    style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {td(
                        "Team membership comes from the parent agent set on each agent record.",
                    )}
                </p>
            </div>
        );
    }

    return (
        <div className="dv2-scroll-x">
            <div style={{ minWidth: 900 }}>
                <div
                    className="dv2-eyebrow"
                    style={{
                        display: "grid",
                        gridTemplateColumns: GRID,
                        columnGap: 14,
                        padding: "9px 18px",
                        background: T.SURFACE_2,
                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    <div>{td("Agent")}</div>
                    <div style={{ textAlign: "right" }}>{td("Leads")}</div>
                    <div style={{ textAlign: "right" }}>{td("Meetings")}</div>
                    <div>
                        {td("Contacted in")} {data.sla_hours}h
                    </div>
                    <div style={{ textAlign: "right" }}>{td("Deals")}</div>
                    <div style={{ textAlign: "right" }}>{td("Won")}</div>
                    <div style={{ textAlign: "right" }}>{td("Open")}</div>
                    <div>{td("Needs attention")}</div>
                </div>

                {data.rows.map((row, index) => (
                    <Row
                        key={row.agent_id}
                        row={row}
                        median={data.median_contact_rate}
                        isYou={
                            currentUserId !== undefined &&
                            row.user_id === currentUserId
                        }
                        last={index === data.rows.length - 1}
                    />
                ))}
            </div>
        </div>
    );
}

function Row({
    row,
    median,
    isYou,
    last,
}: {
    row: TeamAgentRow;
    median: number | null;
    isYou: boolean;
    last: boolean;
}) {
    const { td } = useTd();

    const attention = [
        row.sla_breaches
            ? `${row.sla_breaches} ${td("leads over SLA")}`
            : null,
        row.stalled_deals
            ? `${row.stalled_deals} ${td("deals stalled")}`
            : null,
    ].filter(Boolean);

    const rate = row.contact_rate;
    const barColor =
        rate === null
            ? T.BORDER
            : rate >= 80
              ? T.GREEN
              : rate >= 50
                ? T.BLUE
                : T.RED;

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: GRID,
                columnGap: 14,
                alignItems: "center",
                padding: "12px 18px",
                fontSize: 14,
                borderBottom: last ? undefined : `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar
                    size={30}
                    initials={initialsFromName(row.name)}
                    type={isYou ? "watcher" : "agent"}
                    src={row.image}
                />
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {row.name}
                    </div>
                    <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                        {isYou ? `${td("You")} · ` : ""}
                        {row.open_deals} {td("open deals")}
                    </div>
                </div>
            </div>

            <div style={{ textAlign: "right" }}>{row.leads}</div>
            <div style={{ textAlign: "right" }}>{row.meetings}</div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                    style={{
                        flex: 1,
                        position: "relative",
                        height: 8,
                        background: "#f2f4f7",
                        borderRadius: 4,
                    }}
                >
                    <div
                        style={{
                            height: 8,
                            width: `${rate ?? 0}%`,
                            background: barColor,
                            borderRadius: 4,
                        }}
                    />
                    {median !== null && (
                        <span
                            aria-hidden
                            title={`${td("Team median")} ${median}%`}
                            style={{
                                position: "absolute",
                                left: `${median}%`,
                                top: -3,
                                width: 2,
                                height: 14,
                                background: T.TEXT_HINT,
                            }}
                        />
                    )}
                </div>
                <span
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        width: 34,
                        textAlign: "right",
                        color: rate === null ? T.TEXT_HINT : barColor,
                    }}
                >
                    {rate === null ? "—" : `${rate}%`}
                </span>
            </div>

            <div style={{ textAlign: "right" }}>{row.deals}</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>{row.won}</div>
            <div style={{ textAlign: "right", color: T.TEXT_MUTED }}>
                {row.open_deals}
            </div>

            <div
                style={{
                    fontSize: 13,
                    fontWeight: attention.length ? 600 : 400,
                    color: attention.length ? T.RED : T.TEXT_HINT,
                }}
            >
                {attention.length ? attention.join(" · ") : "—"}
            </div>
        </div>
    );
}

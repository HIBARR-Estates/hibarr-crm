import {
    Avatar,
    REDESIGN_TOKENS as T,
    initialsFromName,
} from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { money } from "../personal/format";
import type {
    DownlineAgentRow,
    DownlineAgents,
    DownlineLevelRow,
    DownlineLevels,
} from "../types";

/**
 * The two rollup tables the team view is built from: one row per generation,
 * one row per agent.
 *
 * They live in one file because they are the same table read at two zoom
 * levels — same columns, same money formatting, same "what does depth 0 mean"
 * rule. Splitting them would duplicate all three.
 */

const LEVEL_GRID = "minmax(190px, 1.4fr) .7fr .8fr 1fr 1fr 1fr";
const AGENT_GRID = "minmax(220px, 1.6fr) .7fr .7fr .7fr 1fr 1fr 1fr";

/** Indent per generation on the agent table, in pixels. */
const INDENT = 14;

/**
 * A commission amount as it should read on screen.
 *
 * Falls back to a bare number when the company has no default currency —
 * stamping a symbol we had to guess on a financial figure is worse than
 * showing none.
 */
function amount(value: number, currency: string | null): string {
    return currency
        ? money(value, currency)
        : Math.round(value).toLocaleString("en-US");
}

/**
 * Zero is greyed rather than hidden: on this table it means "measured, and it
 * is nothing", which is a real answer a manager needs to be able to see.
 */
function Money({
    value,
    currency,
    tone,
}: {
    value: number;
    currency: string | null;
    tone?: string;
}) {
    return (
        <div
            style={{
                textAlign: "right",
                fontWeight: value ? 600 : 400,
                color: value ? (tone ?? T.TEXT) : T.TEXT_HINT,
                fontVariantNumeric: "tabular-nums",
            }}
        >
            {amount(value, currency)}
        </div>
    );
}

/** English source strings — the caller translates them through td(). */
function levelLabel(depth: number): string {
    if (depth === 0) return "You";
    if (depth === 1) return "Direct reports";

    return `Level ${depth}`;
}

function HeaderRow({
    grid,
    columns,
}: {
    grid: string;
    columns: Array<{ label: string; align?: "right" }>;
}) {
    const { td } = useTd();

    return (
        <div
            className="dv2-eyebrow"
            style={{
                display: "grid",
                gridTemplateColumns: grid,
                columnGap: 14,
                padding: "9px 18px",
                background: T.SURFACE_2,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            {columns.map((column) => (
                <div key={column.label} style={{ textAlign: column.align }}>
                    {td(column.label)}
                </div>
            ))}
        </div>
    );
}

/**
 * The downline generation by generation.
 *
 * Rows are keyed by the agent who *receives* each commission leg, not the one
 * whose deal produced it, so the levels sum to the tree total without counting
 * an upline differential twice.
 */
export function DownlineLevelTable({ data }: { data: DownlineLevels }) {
    const { td } = useTd();

    // Depth 0 is the viewer's own row; below it there is no downline to read.
    if (data.rows.length <= 1) {
        return (
            <EmptyDownline
                title="No sub-agents yet"
                body="Levels appear once an agent has you set as their parent agent."
            />
        );
    }

    return (
        <div className="dv2-scroll-x">
            <div style={{ minWidth: 720 }}>
                <HeaderRow
                    grid={LEVEL_GRID}
                    columns={[
                        { label: "Level" },
                        { label: "Agents", align: "right" },
                        { label: "Deals won", align: "right" },
                        { label: "Paid", align: "right" },
                        { label: "Pending", align: "right" },
                        { label: "Forecast", align: "right" },
                    ]}
                />

                {data.rows.map((row, index) => (
                    <LevelRow
                        key={row.depth}
                        row={row}
                        currency={data.currency}
                        last={index === data.rows.length - 1}
                    />
                ))}

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: LEVEL_GRID,
                        columnGap: 14,
                        alignItems: "center",
                        padding: "12px 18px",
                        fontSize: 14,
                        background: T.SURFACE_2,
                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    <div style={{ fontWeight: 700, color: T.NAVY }}>
                        {td("Whole tree")}
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 600 }}>
                        {sum(data.rows, "agents")}
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 600 }}>
                        {sum(data.rows, "deals_won")}
                    </div>
                    <Money
                        value={sum(data.rows, "paid")}
                        currency={data.currency}
                        tone={T.GREEN}
                    />
                    <Money
                        value={sum(data.rows, "pending")}
                        currency={data.currency}
                        tone={T.AMBER}
                    />
                    <Money
                        value={sum(data.rows, "forecast")}
                        currency={data.currency}
                    />
                </div>
            </div>
        </div>
    );
}

function LevelRow({
    row,
    currency,
    last,
}: {
    row: DownlineLevelRow;
    currency: string | null;
    last: boolean;
}) {
    const { td } = useTd();

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: LEVEL_GRID,
                columnGap: 14,
                alignItems: "center",
                padding: "12px 18px",
                fontSize: 14,
                borderBottom: last ? undefined : `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <div>
                <div style={{ fontWeight: 600, color: T.NAVY }}>
                    {td(levelLabel(row.depth))}
                </div>
                <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                    {row.deals_open} {td("open deals")}
                </div>
            </div>

            <div style={{ textAlign: "right" }}>{row.agents}</div>
            <div style={{ textAlign: "right" }}>{row.deals_won}</div>
            <Money value={row.paid} currency={currency} tone={T.GREEN} />
            <Money value={row.pending} currency={currency} tone={T.AMBER} />
            <Money value={row.forecast} currency={currency} />
        </div>
    );
}

/**
 * Every agent in the tree, the viewer included and marked.
 *
 * Indentation carries the hierarchy rather than a collapsible tree widget: the
 * rows are already ordered depth-first by the server, and a manager scanning a
 * commission column needs every row on screen at once.
 */
export function DownlineAgentTable({
    data,
    currentUserId,
}: {
    data: DownlineAgents;
    currentUserId?: number;
}) {
    if (data.rows.length <= 1) {
        return (
            <EmptyDownline
                title="No agents report to you yet"
                body="An agent joins your downline when your agent record is set as their parent agent."
            />
        );
    }

    return (
        <div className="dv2-scroll-x">
            <div style={{ minWidth: 860 }}>
                <HeaderRow
                    grid={AGENT_GRID}
                    columns={[
                        { label: "Agent" },
                        { label: "Reports", align: "right" },
                        { label: "Open", align: "right" },
                        { label: "Won", align: "right" },
                        { label: "Paid", align: "right" },
                        { label: "Pending", align: "right" },
                        { label: "Forecast", align: "right" },
                    ]}
                />

                {data.rows.map((row, index) => (
                    <AgentRow
                        key={row.agent_id}
                        row={row}
                        currency={data.currency}
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

function AgentRow({
    row,
    currency,
    isYou,
    last,
}: {
    row: DownlineAgentRow;
    currency: string | null;
    isYou: boolean;
    last: boolean;
}) {
    const { td } = useTd();

    // The MLM level is a rank ("Gold"), the depth is a generation. They are
    // deliberately not both spelled "level" here: depth is carried by the
    // indent and the branch glyph, so the only word on the row is the rank.
    const meta = [isYou ? td("You") : null, row.level].filter(Boolean);

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: AGENT_GRID,
                columnGap: 14,
                alignItems: "center",
                padding: "12px 18px",
                fontSize: 14,
                borderBottom: last ? undefined : `1px solid ${T.BORDER_SOFT}`,
                background: isYou ? T.SURFACE_2 : undefined,
            }}
            // The indent alone cannot be read by a screen reader, and on a
            // wide tree it is easy to lose count by eye as well.
            title={`${row.name} — ${td("level")} ${row.depth}`}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    paddingLeft: row.depth * INDENT,
                }}
            >
                {row.depth > 0 && (
                    <span
                        aria-hidden
                        style={{ color: T.TEXT_HINT, marginLeft: -6 }}
                    >
                        └
                    </span>
                )}
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
                        {meta.join(" · ") || td("No level assigned")}
                    </div>
                </div>
            </div>

            <div style={{ textAlign: "right" }}>
                {row.direct_reports || "—"}
            </div>
            <div style={{ textAlign: "right", color: T.TEXT_MUTED }}>
                {row.deals_open}
            </div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
                {row.deals_won}
            </div>
            <Money value={row.paid} currency={currency} tone={T.GREEN} />
            <Money value={row.pending} currency={currency} tone={T.AMBER} />
            <Money value={row.forecast} currency={currency} />
        </div>
    );
}

/** Shared empty state — a manager with no sub-agents is a normal state. */
function EmptyDownline({ title, body }: { title: string; body: string }) {
    const { td } = useTd();

    return (
        <div style={{ padding: 18 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                {td(title)}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                {td(body)}
            </p>
        </div>
    );
}

function sum<K extends keyof DownlineLevelRow>(
    rows: DownlineLevelRow[],
    key: K,
): number {
    return rows.reduce((total, row) => total + (row[key] as number), 0);
}

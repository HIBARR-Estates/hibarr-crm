import { useState } from "react";
import {
    Avatar,
    REDESIGN_TOKENS as T,
    initialsFromName,
} from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { amount } from "../format";
import type { TeamTree as TeamTreeData, TeamTreeNode } from "../types";

const GRID =
    "minmax(240px, 2fr) .8fr .8fr .8fr 1fr 1fr";

/** Indent per generation, in pixels. */
const INDENT = 20;

/**
 * The network as a hierarchy, one row per person.
 *
 * A tree rather than a flat table because the shape is the point: who recruited
 * whom is what a team lead is reading for, and a sorted list throws it away.
 * Rows with reports collapse, so a wide network is scannable at the top level
 * and drillable where it matters.
 *
 * Each row carries two numbers per column. The large one is this person's own;
 * the small one under it is their branch including them. They diverge exactly
 * where someone has built a team, which is the thing worth spotting.
 */
export default function TeamTree({
    data,
    currentUserId,
}: {
    data: TeamTreeData;
    currentUserId?: number;
}) {
    const { td } = useTd();

    if (!data.nodes.length) {
        return (
            <div style={{ padding: 18 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {td("Nobody reports to you yet")}
                </p>
                <p
                    style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {td(
                        "An agent joins your network when your agent record is set as their parent agent.",
                    )}
                </p>
            </div>
        );
    }

    return (
        <div className="dv2-scroll-x">
            <div style={{ minWidth: 860 }}>
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
                    <div>{td("Person")}</div>
                    <div style={{ textAlign: "right" }}>{td("Active deals")}</div>
                    <div style={{ textAlign: "right" }}>{td("Leads in play")}</div>
                    <div style={{ textAlign: "right" }}>{td("Won")}</div>
                    <div style={{ textAlign: "right" }}>{td("Paid")}</div>
                    <div style={{ textAlign: "right" }}>{td("Pending")}</div>
                </div>

                {data.nodes.map((node) => (
                    <Branch
                        key={node.agent_id}
                        node={node}
                        currency={data.currency}
                        currentUserId={currentUserId}
                    />
                ))}

                <p
                    style={{
                        margin: 0,
                        padding: "10px 18px",
                        fontSize: 12,
                        color: T.TEXT_HINT,
                        background: T.SURFACE_2,
                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    {td(
                        "Large figure is the person's own. Small figure under it is their whole branch, themselves included.",
                    )}
                </p>
            </div>
        </div>
    );
}

/** One person and, when expanded, everyone under them. */
function Branch({
    node,
    currency,
    currentUserId,
}: {
    node: TeamTreeNode;
    currency: string | null;
    currentUserId?: number;
}) {
    const { td } = useTd();

    // Open to start: a network you have to click twice to see is one you stop
    // looking at. Deep branches can be folded away once read.
    const [open, setOpen] = useState(true);
    const hasChildren = node.children.length > 0;
    const isYou =
        currentUserId !== undefined && node.user_id === currentUserId;

    return (
        <>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: GRID,
                    columnGap: 14,
                    alignItems: "center",
                    padding: "10px 18px",
                    fontSize: 14,
                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        paddingLeft: (node.depth - 1) * INDENT,
                        minWidth: 0,
                    }}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            className="dv2-tree-toggle"
                            aria-expanded={open}
                            aria-label={
                                open
                                    ? `${td("Collapse")} ${node.name}`
                                    : `${td("Expand")} ${node.name}`
                            }
                            onClick={() => setOpen((was) => !was)}
                        >
                            {open ? "−" : "+"}
                        </button>
                    ) : (
                        // Keeps names aligned whether or not a row can open.
                        <span style={{ width: 18, flexShrink: 0 }} aria-hidden />
                    )}

                    <Avatar
                        size={28}
                        initials={initialsFromName(node.name)}
                        type={isYou ? "watcher" : "agent"}
                        src={node.image}
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
                            {node.name}
                        </div>
                        <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                            {[
                                node.level ?? td("No level"),
                                hasChildren
                                    ? `${node.network.agents - 1} ${td("in their network")}`
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </div>
                    </div>
                </div>

                <Cell own={node.own.active_deals} network={node.network.active_deals} />
                <Cell own={node.own.leads_active} network={node.network.leads_active} />
                <Cell own={node.own.deals_won} network={node.network.deals_won} />
                <Cell
                    own={amount(node.own.paid, currency)}
                    network={amount(node.network.paid, currency)}
                    tone={node.own.paid ? T.GREEN : undefined}
                />
                <Cell
                    own={amount(node.own.pending, currency)}
                    network={amount(node.network.pending, currency)}
                    tone={node.own.pending ? T.AMBER : undefined}
                />
            </div>

            {open &&
                node.children.map((child) => (
                    <Branch
                        key={child.agent_id}
                        node={child}
                        currency={currency}
                        currentUserId={currentUserId}
                    />
                ))}
        </>
    );
}

/**
 * Own figure over branch figure.
 *
 * The branch line is dropped when it matches — repeating the same number twice
 * says only that this person has nobody under them, which the row already
 * shows.
 */
function Cell({
    own,
    network,
    tone,
}: {
    own: number | string;
    network: number | string;
    tone?: string;
}) {
    const { td } = useTd();
    const differs = String(own) !== String(network);

    return (
        <div style={{ textAlign: "right" }}>
            <div
                style={{
                    fontWeight: 600,
                    color: tone ?? (own ? T.TEXT : T.TEXT_HINT),
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {own}
            </div>
            {differs && (
                <div
                    style={{
                        fontSize: 12,
                        color: T.TEXT_HINT,
                        fontVariantNumeric: "tabular-nums",
                    }}
                    title={td("Including their network")}
                >
                    {network}
                </div>
            )}
        </div>
    );
}

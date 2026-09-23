import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
    Background,
    Controls,
    Handle,
    MiniMap,
    Position,
    ReactFlow,
    type Edge,
    type Node,
    type NodeProps,
    type NodeTypes,
} from "@xyflow/react";
import { Graph, layout as dagreLayout } from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import {
    Avatar,
    REDESIGN_TOKENS as T,
    initialsFromName,
} from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import { amount } from "../format";
import type {
    TeamSummary,
    TeamTree as TeamTreeData,
    TeamTreeNode,
} from "../types";

/** Children shown before a branch offers "+N more" on the parent card. */
const INITIAL_VISIBLE = 6;
const PAGE_SIZE = 10;

const CARD_WIDTH = 220;
/** Person cards with a branch line under the level need a touch more room. */
const PERSON_HEIGHT = 124;
const PERSON_HEIGHT_WITH_BRANCH = 136;
const YOU_HEIGHT = 148;
/** Extra height when the parent card carries expand / collapse controls. */
const BRANCH_FOOTER_HEIGHT = 36;

/**
 * Expand / collapse for a parent's direct reports.
 *
 * Lives on the parent card — not as a sibling node in the tree — so there is
 * never an edge fanning out to a "+N more" pill across the other children.
 */
interface BranchControls {
    key: string;
    /** How many direct reports are still hidden. 0 when the branch is fully open. */
    hiddenCount: number;
    /** True once the viewer has paged past the initial slice. */
    canCollapse: boolean;
}

interface RawPerson {
    kind: "you" | "person";
    node?: TeamTreeNode;
    name: string;
    image?: string | null;
    level?: string | null;
    branch?: BranchControls;
}

type RawDatum = RawPerson;

interface TreeDatum {
    id: string;
    __raw: RawDatum;
    children?: TreeDatum[];
}

type NetworkNode = Node<{ raw: RawDatum }, "network">;

/**
 * What clicking the graph hands back to the page.
 *
 * "You" carries no node of its own — the viewer isn't in the tree, by design
 * — so there's nothing here for it beyond the discriminant. The page already
 * holds the viewer's totals (teamSummary / teamForecast, the same numbers the
 * tile row shows) and reads those directly when this kind comes back.
 */
export type GraphSelection =
    | { kind: "you" }
    | { kind: "person"; node: TeamTreeNode };

const GraphUi = createContext<{
    t: (key: string, options?: Record<string, unknown>) => string;
    currency: string | null;
    networkSummary?: TeamSummary | null;
    onSelect?: (selection: GraphSelection) => void;
    toggle: (parentKey: string, expand: boolean) => void;
    activate: (raw: RawDatum) => void;
} | null>(null);

/**
 * The network as a real hierarchy — nodes and the lines between them.
 *
 * React Flow (`@xyflow/react`) rather than react-d3-tree: each card is a
 * normal React node, not HTML stuffed into an SVG foreignObject, so the
 * avatar / figures stay contained, clickable and sharp while pan, zoom,
 * fit-to-view and a minimap come with the canvas. Dagre only places the
 * tree (top-down); it does not draw anything.
 *
 * Wide branches collapse behind a "+N more" control on the *parent* card —
 * never as a sibling in the child row, which put an edge across the others.
 */
export default function TeamNetworkGraph({
    data,
    onSelect,
    height = 560,
    networkSummary,
}: {
    data: TeamTreeData;
    onSelect?: (selection: GraphSelection) => void;
    height?: number;
    networkSummary?: TeamSummary | null;
}) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState<Map<string, number>>(new Map());

    const toggle = useCallback((parentKey: string, expand: boolean) => {
        setExpanded((prev) => {
            const next = new Map(prev);

            if (expand) {
                next.set(
                    parentKey,
                    (prev.get(parentKey) ?? INITIAL_VISIBLE) + PAGE_SIZE,
                );
            } else {
                next.delete(parentKey);
            }

            return next;
        });
    }, []);

    const toTreeDatum = useCallback(
        (node: TeamTreeNode, parentKey: string): TreeDatum => {
            const key = `${parentKey}.${node.agent_id}`;
            const { children, branch } = sliceDirectReports(
                node.children,
                key,
                expanded,
                (child) => toTreeDatum(child, key),
            );

            return {
                id: `p-${node.agent_id}`,
                __raw: {
                    kind: "person",
                    node,
                    name: node.name,
                    image: node.image,
                    level: node.level,
                    branch,
                },
                children,
            };
        },
        [expanded],
    );

    const treeData = useMemo((): TreeDatum => {
        const key = "root";
        const { children, branch } = sliceDirectReports(
            data.nodes,
            key,
            expanded,
            (node) => toTreeDatum(node, key),
        );

        return {
            id: "you",
            __raw: {
                kind: "you",
                name: data.your_name ?? "You",
                image: data.your_image,
                level: data.your_level,
                branch,
            },
            children,
        };
    }, [data, expanded, toTreeDatum]);

    const { nodes, edges } = useMemo(
        () => layoutTree(treeData),
        [treeData],
    );

    const activate = useCallback(
        (raw: RawDatum) => {
            if (raw.kind === "you") {
                onSelect?.({ kind: "you" });
                return;
            }

            if (raw.kind === "person" && raw.node) {
                onSelect?.({ kind: "person", node: raw.node });
            }
        },
        [onSelect],
    );

    const ui = useMemo(
        () => ({
            t,
            currency: data.currency,
            networkSummary,
            onSelect,
            toggle,
            activate,
        }),
        [t, data.currency, networkSummary, onSelect, toggle, activate],
    );

    if (!data.nodes.length) {
        return (
            <div style={{ padding: 18 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {t("pages.dashboard.team.graph.empty_title")}
                </p>
                <p
                    style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {t("pages.dashboard.team.graph.empty_body")}
                </p>
            </div>
        );
    }

    return (
        <GraphUi.Provider value={ui}>
            <div
                className="dv2-network-flow"
                style={{ height, background: T.SURFACE_2 }}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    edgesFocusable={false}
                    elementsSelectable
                    panOnDrag
                    zoomOnScroll
                    minZoom={0.15}
                    maxZoom={2}
                    fitView
                    fitViewOptions={{ padding: 0.18, maxZoom: 0.95 }}
                    onNodeClick={(_, node) => activate(node.data.raw)}
                    proOptions={{ hideAttribution: false }}
                    defaultEdgeOptions={{
                        type: "smoothstep",
                        selectable: false,
                        style: { stroke: "#c5cdd8", strokeWidth: 1.5 },
                    }}
                >
                    <Background
                        gap={18}
                        size={1}
                        color="#e7eaf0"
                    />
                    <Controls
                        showInteractive={false}
                        position="bottom-left"
                    />
                    <MiniMap
                        pannable
                        zoomable
                        position="bottom-right"
                        nodeColor={miniMapColor}
                        maskColor="rgba(22, 41, 77, 0.08)"
                    />
                </ReactFlow>
            </div>
        </GraphUi.Provider>
    );
}

/**
 * Visible direct reports plus the expand/collapse payload for the parent.
 *
 * Only person nodes become tree children — the "+N more" / "Show less"
 * actions ride on the parent card so the graph never draws an edge to them.
 */
function branchMetricsDiffer(
    own: TeamTreeNode["own"] | undefined,
    network: TeamTreeNode["network"] | undefined,
): boolean {
    return Boolean(
        own &&
            network &&
            (own.paid !== network.paid ||
                own.active_deals !== network.active_deals),
    );
}

function sliceDirectReports(
    reports: TeamTreeNode[],
    parentKey: string,
    expanded: Map<string, number>,
    mapChild: (node: TeamTreeNode) => TreeDatum,
): { children: TreeDatum[]; branch?: BranchControls } {
    const visible = expanded.get(parentKey) ?? INITIAL_VISIBLE;
    const children = reports.slice(0, visible).map(mapChild);
    const hiddenCount = Math.max(0, reports.length - visible);
    const canCollapse =
        visible > INITIAL_VISIBLE && reports.length > INITIAL_VISIBLE;

    if (hiddenCount === 0 && !canCollapse) {
        return { children };
    }

    return {
        children,
        branch: { key: parentKey, hiddenCount, canCollapse },
    };
}

function NetworkCard({ data, selected }: NodeProps<NetworkNode>) {
    const ui = useContext(GraphUi);
    const raw = data.raw;

    if (!ui) {
        return null;
    }

    const isYou = raw.kind === "you";
    const node = raw.kind === "person" ? raw.node : undefined;
    const own = node?.own;
    const network = node?.network;
    const branch = raw.branch;
    const branchDiffers = branchMetricsDiffer(own, network);

    const yourPaid =
        ui.networkSummary === undefined
            ? null
            : amount(
                  ui.networkSummary?.paid ?? 0,
                  ui.networkSummary?.currency ?? null,
              );
    const yourActiveDeals =
        ui.networkSummary === undefined
            ? null
            : (ui.networkSummary?.active_deals ?? 0);

    return (
        <>
            <Handle type="target" position={Position.Top} className="dv2-network-handle" />
            <div className="dv2-tree-node">
                <button
                    type="button"
                    className="dv2-tree-card nodrag nopan"
                    data-you={isYou || undefined}
                    data-selected={selected || undefined}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        ui.activate(raw);
                    }}
                >
                    <div className="dv2-tree-card-head">
                        <Avatar
                            size={28}
                            initials={initialsFromName(raw.name)}
                            type={isYou ? "watcher" : "agent"}
                            src={raw.image}
                        />
                        <div style={{ minWidth: 0 }}>
                            <div className="dv2-tree-card-name">
                                {raw.name}
                                {isYou && (
                                    <span className="dv2-tree-card-you">
                                        {" "}
                                        · {ui.t("pages.dashboard.team.graph.you")}
                                    </span>
                                )}
                            </div>
                            <div className="dv2-tree-card-level">
                                {raw.level ??
                                    ui.t("pages.dashboard.team.graph.no_level")}
                            </div>
                            {!isYou && branchDiffers && network && (
                                <div
                                    className="dv2-tree-card-branch"
                                    title={ui.t(
                                        "pages.dashboard.team.graph.branch_hint_title",
                                    )}
                                >
                                    {ui.t(
                                        "pages.dashboard.team.graph.branch_active_deals",
                                        { count: network.active_deals },
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {isYou ? (
                        <>
                            <div className="dv2-tree-card-stats">
                                <div>
                                    <div className="dv2-tree-card-stat-value">
                                        {yourPaid ?? "—"}
                                    </div>
                                    <div className="dv2-tree-card-stat-label">
                                        {ui.t(
                                            "pages.dashboard.team.graph.network_paid",
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="dv2-tree-card-stat-value">
                                        {yourActiveDeals ?? "—"}
                                    </div>
                                    <div className="dv2-tree-card-stat-label">
                                        {ui.t(
                                            "pages.dashboard.team.graph.active_deals",
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div
                                className="dv2-tree-card-hint"
                                title={ui.t(
                                    "pages.dashboard.team.graph.you_hint_title",
                                )}
                            >
                                {ui.t(
                                    "pages.dashboard.team.graph.click_breakdown",
                                )}
                            </div>
                        </>
                    ) : (
                        own && (
                            <div className="dv2-tree-card-stats">
                                <div>
                                    <div className="dv2-tree-card-stat-value">
                                        {amount(own.paid, ui.currency)}
                                    </div>
                                    <div className="dv2-tree-card-stat-label">
                                        {ui.t(
                                            "pages.dashboard.team.graph.paid",
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="dv2-tree-card-stat-value">
                                        {own.active_deals}
                                    </div>
                                    <div className="dv2-tree-card-stat-label">
                                        {ui.t(
                                            "pages.dashboard.team.graph.active_deals",
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </button>

                {branch && (
                    <div className="dv2-tree-branch-actions">
                        {branch.hiddenCount > 0 && (
                            <button
                                type="button"
                                className="dv2-tree-pill dv2-tree-pill-more nodrag nopan"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    ui.toggle(branch.key, true);
                                }}
                            >
                                +{branch.hiddenCount}{" "}
                                {ui.t("pages.dashboard.team.graph.more")}
                            </button>
                        )}
                        {branch.canCollapse && (
                            <button
                                type="button"
                                className="dv2-tree-pill dv2-tree-pill-less nodrag nopan"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    ui.toggle(branch.key, false);
                                }}
                            >
                                {ui.t("pages.dashboard.team.graph.show_less")}
                            </button>
                        )}
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="dv2-network-handle" />
        </>
    );
}

const nodeTypes: NodeTypes = { network: NetworkCard };

function personCardHeight(raw: RawPerson): number {
    return branchMetricsDiffer(raw.node?.own, raw.node?.network)
        ? PERSON_HEIGHT_WITH_BRANCH
        : PERSON_HEIGHT;
}

function nodeSize(raw: RawDatum): { width: number; height: number } {
    const base =
        raw.kind === "you"
            ? YOU_HEIGHT
            : personCardHeight(raw);
    const footer = raw.branch ? BRANCH_FOOTER_HEIGHT : 0;

    return {
        width: CARD_WIDTH,
        height: base + footer,
    };
}

function layoutTree(root: TreeDatum): { nodes: NetworkNode[]; edges: Edge[] } {
    const nodes: NetworkNode[] = [];
    const edges: Edge[] = [];

    const walk = (datum: TreeDatum, parentId: string | null) => {
        const size = nodeSize(datum.__raw);

        nodes.push({
            id: datum.id,
            type: "network",
            position: { x: 0, y: 0 },
            data: { raw: datum.__raw },
            className: "nopan nodrag",
            draggable: false,
            connectable: false,
            selectable: true,
            style: { width: size.width, height: size.height },
            width: size.width,
            height: size.height,
        });

        if (parentId) {
            edges.push({
                id: `${parentId}->${datum.id}`,
                source: parentId,
                target: datum.id,
                selectable: false,
            });
        }

        datum.children?.forEach((child) => walk(child, datum.id));
    };

    walk(root, null);

    const g = new Graph({ directed: true });
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: "TB",
        nodesep: 28,
        ranksep: 52,
        marginx: 16,
        marginy: 16,
    });

    for (const node of nodes) {
        g.setNode(node.id, {
            width: node.width ?? CARD_WIDTH,
            height: node.height ?? PERSON_HEIGHT,
        });
    }

    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }

    dagreLayout(g);

    const laidOut = nodes.map((node) => {
        const placed = g.node(node.id);
        const width = node.width ?? CARD_WIDTH;
        const height = node.height ?? PERSON_HEIGHT;

        return {
            ...node,
            position: {
                x: placed.x - width / 2,
                y: placed.y - height / 2,
            },
        };
    });

    return { nodes: laidOut, edges };
}

function miniMapColor(node: Node): string {
    const raw = (node.data as { raw?: RawDatum } | undefined)?.raw;

    if (raw?.kind === "you") {
        return "#c5ddf4";
    }

    return "#ffffff";
}

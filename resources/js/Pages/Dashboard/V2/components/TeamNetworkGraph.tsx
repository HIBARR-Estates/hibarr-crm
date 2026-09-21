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
import { useTd } from "@/Hooks/useDynamicTranslation";
import { amount } from "../format";
import type {
    TeamSummary,
    TeamTree as TeamTreeData,
    TeamTreeNode,
} from "../types";

/** Children shown before a branch collapses into a "+N more" pill. */
const INITIAL_VISIBLE = 6;
const PAGE_SIZE = 10;

const CARD_WIDTH = 220;
const PERSON_HEIGHT = 124;
const YOU_HEIGHT = 148;
const PILL_WIDTH = 168;
const PILL_HEIGHT = 44;

interface RawPerson {
    kind: "you" | "person";
    node?: TeamTreeNode;
    name: string;
    image?: string | null;
    level?: string | null;
}

interface RawShowMore {
    kind: "show-more";
    parentKey: string;
    hiddenCount: number;
}

interface RawShowLess {
    kind: "show-less";
    parentKey: string;
}

type RawDatum = RawPerson | RawShowMore | RawShowLess;

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
    td: (source: string) => string;
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
 * avatar / figures / "+N more" pills stay contained, clickable and sharp
 * while pan, zoom, fit-to-view and a minimap come with the canvas. Dagre
 * only places the tree (top-down); it does not draw anything.
 *
 * Wide branches still collapse behind a "+N more" pill — the same control
 * the previous renderer offered — reimplemented as extra nodes in the flow.
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
    const { td } = useTd();
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
            const visible = expanded.get(key) ?? INITIAL_VISIBLE;
            const kids = node.children;
            const children: TreeDatum[] = [];

            if (kids.length <= visible) {
                children.push(
                    ...kids.map((child) => toTreeDatum(child, key)),
                );
            } else {
                children.push(
                    ...kids
                        .slice(0, visible)
                        .map((child) => toTreeDatum(child, key)),
                    {
                        id: `more-${key}`,
                        __raw: {
                            kind: "show-more",
                            parentKey: key,
                            hiddenCount: kids.length - visible,
                        },
                    },
                );
            }

            if (visible > INITIAL_VISIBLE && kids.length > INITIAL_VISIBLE) {
                children.push({
                    id: `less-${key}`,
                    __raw: { kind: "show-less", parentKey: key },
                });
            }

            return {
                id: `p-${node.agent_id}`,
                __raw: {
                    kind: "person",
                    node,
                    name: node.name,
                    image: node.image,
                    level: node.level,
                },
                children,
            };
        },
        [expanded],
    );

    const treeData = useMemo((): TreeDatum => {
        const key = "root";
        const visible = expanded.get(key) ?? INITIAL_VISIBLE;
        const children: TreeDatum[] = [];

        if (data.nodes.length <= visible) {
            children.push(
                ...data.nodes.map((node) => toTreeDatum(node, key)),
            );
        } else {
            children.push(
                ...data.nodes
                    .slice(0, visible)
                    .map((node) => toTreeDatum(node, key)),
                {
                    id: "more-root",
                    __raw: {
                        kind: "show-more",
                        parentKey: key,
                        hiddenCount: data.nodes.length - visible,
                    },
                },
            );
        }

        if (visible > INITIAL_VISIBLE && data.nodes.length > INITIAL_VISIBLE) {
            children.push({
                id: "less-root",
                __raw: { kind: "show-less", parentKey: key },
            });
        }

        return {
            id: "you",
            __raw: {
                kind: "you",
                name: data.your_name ?? "You",
                image: data.your_image,
                level: data.your_level,
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
            if (raw.kind === "show-more") {
                toggle(raw.parentKey, true);
                return;
            }

            if (raw.kind === "show-less") {
                toggle(raw.parentKey, false);
                return;
            }

            if (raw.kind === "you") {
                onSelect?.({ kind: "you" });
                return;
            }

            if (raw.kind === "person" && raw.node) {
                onSelect?.({ kind: "person", node: raw.node });
            }
        },
        [onSelect, toggle],
    );

    const ui = useMemo(
        () => ({
            td,
            currency: data.currency,
            networkSummary,
            onSelect,
            toggle,
            activate,
        }),
        [td, data.currency, networkSummary, onSelect, toggle, activate],
    );

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

function NetworkCard({ data, selected }: NodeProps<NetworkNode>) {
    const ui = useContext(GraphUi);
    const raw = data.raw;

    if (!ui) {
        return null;
    }

    if (raw.kind === "show-more") {
        return (
            <>
                <Handle type="target" position={Position.Top} className="dv2-network-handle" />
                <button
                    type="button"
                    className="dv2-tree-pill dv2-tree-pill-more nodrag nopan"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        ui.activate(raw);
                    }}
                >
                    +{raw.hiddenCount} {ui.td("more")}
                </button>
                <Handle type="source" position={Position.Bottom} className="dv2-network-handle" />
            </>
        );
    }

    if (raw.kind === "show-less") {
        return (
            <>
                <Handle type="target" position={Position.Top} className="dv2-network-handle" />
                <button
                    type="button"
                    className="dv2-tree-pill dv2-tree-pill-less nodrag nopan"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        ui.activate(raw);
                    }}
                >
                    {ui.td("Show less")}
                </button>
            </>
        );
    }

    const isYou = raw.kind === "you";
    const node = raw.kind === "person" ? raw.node : undefined;
    const own = node?.own;
    const network = node?.network;
    const branchDiffers =
        own &&
        network &&
        (own.paid !== network.paid || own.active_deals !== network.active_deals);

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
                                    · {ui.td("You")}
                                </span>
                            )}
                        </div>
                        <div className="dv2-tree-card-level">
                            {raw.level ?? ui.td("No level")}
                        </div>
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
                                    {ui.td("Network paid")}
                                </div>
                            </div>
                            <div>
                                <div className="dv2-tree-card-stat-value">
                                    {yourActiveDeals ?? "—"}
                                </div>
                                <div className="dv2-tree-card-stat-label">
                                    {ui.td("Active deals")}
                                </div>
                            </div>
                        </div>
                        <div
                            className="dv2-tree-card-hint"
                            title={ui.td(
                                "The same totals as the tile row above, for the whole network below you.",
                            )}
                        >
                            {ui.td("Click for the full breakdown")}
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
                                    {ui.td("Paid")}
                                </div>
                            </div>
                            <div>
                                <div className="dv2-tree-card-stat-value">
                                    {own.active_deals}
                                </div>
                                <div className="dv2-tree-card-stat-label">
                                    {ui.td("Active deals")}
                                </div>
                            </div>
                            {branchDiffers && (
                                <div
                                    className="dv2-tree-card-branch"
                                    title={ui.td(
                                        "This person's own figures are above. This line adds everyone below them in the network.",
                                    )}
                                >
                                    {ui.td("Branch")}: {network.active_deals}{" "}
                                    {ui.td("active deals")}
                                </div>
                            )}
                        </div>
                    )
                )}
            </button>
            <Handle type="source" position={Position.Bottom} className="dv2-network-handle" />
        </>
    );
}

const nodeTypes: NodeTypes = { network: NetworkCard };

function nodeSize(raw: RawDatum): { width: number; height: number } {
    if (raw.kind === "show-more" || raw.kind === "show-less") {
        return { width: PILL_WIDTH, height: PILL_HEIGHT };
    }

    return {
        width: CARD_WIDTH,
        height: raw.kind === "you" ? YOU_HEIGHT : PERSON_HEIGHT,
    };
}

function layoutTree(root: TreeDatum): { nodes: NetworkNode[]; edges: Edge[] } {
    const nodes: NetworkNode[] = [];
    const edges: Edge[] = [];

    const walk = (datum: TreeDatum, parentId: string | null) => {
        const size = nodeSize(datum.__raw);
        const isPerson =
            datum.__raw.kind === "you" || datum.__raw.kind === "person";

        nodes.push({
            id: datum.id,
            type: "network",
            position: { x: 0, y: 0 },
            data: { raw: datum.__raw },
            className: "nopan nodrag",
            draggable: false,
            connectable: false,
            // Pills stay unselected so they don't draw a ring, but they must
            // still receive pointer events — React Flow sets pointer-events:
            // none on a node that is neither selectable, draggable, nor given
            // an onNodeClick. onNodeClick covers that; this keeps inspect
            // highlight on people only.
            selectable: isPerson,
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

    if (raw?.kind === "show-more" || raw?.kind === "show-less") {
        return "#e8eaf0";
    }

    return "#ffffff";
}

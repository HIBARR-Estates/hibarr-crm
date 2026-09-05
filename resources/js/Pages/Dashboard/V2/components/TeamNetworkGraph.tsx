import { useCallback, useMemo, useRef, useState } from "react";
import Tree from "react-d3-tree";
import {
    Avatar,
    REDESIGN_TOKENS as T,
    initialsFromName,
} from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { amount } from "../format";
import type { TeamTree as TeamTreeData, TeamTreeNode } from "../types";

/** Children shown before a branch collapses into a "+N more" pill. */
const INITIAL_VISIBLE = 6;
const PAGE_SIZE = 10;

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

/**
 * Our own node shape, with react-d3-tree's `name` kept only because the
 * library requires the field to exist — everything this component reads
 * comes from `__raw`. Untyped against the library's own RawNodeDatum, same as
 * AgentTreeView: react-d3-tree's shipped types don't resolve cleanly through
 * this project's module resolution, and the render prop is cast at the call
 * site regardless.
 */
interface TreeDatum {
    name: string;
    __raw: RawDatum;
    children?: TreeDatum[];
}

/**
 * The network as a real hierarchy — nodes and the lines between them, not a
 * table pretending to be one.
 *
 * Built on react-d3-tree, the same library the MLM module already uses for
 * this exact job in AgentTreeView (My Network). This is a separate renderer
 * rather than a reuse of that one: AgentTreeView's cards are shaped around
 * NSA/NSD/VSA/VSD cycle metrics and an upline node, neither of which exists on
 * this page — here every card carries this dashboard's own figures, and the
 * root of the graph is the viewer, drawn above the team whose numbers are the
 * ones that count.
 *
 * Wide branches collapse behind a "+N more" pill rather than rendering every
 * node at once — the same shape of control AgentTreeView offers, reimplemented
 * against TeamTreeNode instead of AgentHierarchyNode.
 */
export default function TeamNetworkGraph({
    data,
    onSelect,
    height = 560,
}: {
    data: TeamTreeData;
    /** Fired with the clicked person, or null when the "You" root is clicked. */
    onSelect?: (node: TeamTreeNode | null) => void;
    height?: number;
}) {
    const { td } = useTd();
    const containerRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState<Map<string, number>>(new Map());

    const toggle = useCallback((parentKey: string, expand: boolean) => {
        setExpanded((prev) => {
            const next = new Map(prev);

            if (expand) {
                next.set(parentKey, (prev.get(parentKey) ?? INITIAL_VISIBLE) + PAGE_SIZE);
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

            let children: TreeDatum[];

            if (kids.length <= visible) {
                children = kids.map((child) => toTreeDatum(child, key));
            } else {
                children = kids
                    .slice(0, visible)
                    .map((child) => toTreeDatum(child, key));
                children.push({
                    name: "",
                    __raw: {
                        kind: "show-more",
                        parentKey: key,
                        hiddenCount: kids.length - visible,
                    },
                });
            }

            if (visible > INITIAL_VISIBLE && kids.length > INITIAL_VISIBLE) {
                children.push({
                    name: "",
                    __raw: { kind: "show-less", parentKey: key },
                });
            }

            return {
                name: node.name,
                __raw: { kind: "person", node, name: node.name, image: node.image, level: node.level },
                children,
            };
        },
        [expanded],
    );

    const treeData = useMemo((): TreeDatum => {
        const key = "root";
        const visible = expanded.get(key) ?? INITIAL_VISIBLE;

        let children: TreeDatum[];

        if (data.nodes.length <= visible) {
            children = data.nodes.map((node) => toTreeDatum(node, key));
        } else {
            children = data.nodes
                .slice(0, visible)
                .map((node) => toTreeDatum(node, key));
            children.push({
                name: "",
                __raw: {
                    kind: "show-more",
                    parentKey: key,
                    hiddenCount: data.nodes.length - visible,
                },
            });
        }

        return {
            name: data.your_name ?? "You",
            __raw: {
                kind: "you",
                name: data.your_name ?? "You",
                image: data.your_image,
                level: data.your_level,
            },
            children,
        };
    }, [data, expanded, toTreeDatum]);

    const renderNode = useCallback(
        ({ nodeDatum }: { nodeDatum: TreeDatum }) => {
            const raw = nodeDatum.__raw;

            if (raw.kind === "show-more") {
                return (
                    <g>
                        <foreignObject width={170} height={52} x={-85} y={-26} style={{ overflow: "visible" }}>
                            <button
                                type="button"
                                className="dv2-tree-pill dv2-tree-pill-more"
                                onClick={() => toggle(raw.parentKey, true)}
                            >
                                +{raw.hiddenCount} {td("more")}
                            </button>
                        </foreignObject>
                    </g>
                );
            }

            if (raw.kind === "show-less") {
                return (
                    <g>
                        <foreignObject width={150} height={48} x={-75} y={-24} style={{ overflow: "visible" }}>
                            <button
                                type="button"
                                className="dv2-tree-pill dv2-tree-pill-less"
                                onClick={() => toggle(raw.parentKey, false)}
                            >
                                {td("Show less")}
                            </button>
                        </foreignObject>
                    </g>
                );
            }

            const isYou = raw.kind === "you";
            const node = raw.kind === "person" ? raw.node : undefined;
            const own = node?.own;
            const network = node?.network;
            const branchDiffers =
                own && network && (own.paid !== network.paid || own.active_deals !== network.active_deals);

            return (
                <g>
                    <foreignObject width={210} height={124} x={-105} y={-62} style={{ overflow: "visible" }}>
                        <div
                            className="dv2-tree-card"
                            data-you={isYou || undefined}
                            onClick={() => onSelect?.(node ?? null)}
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
                                                · {td("You")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="dv2-tree-card-level">
                                        {raw.level ?? td("No level")}
                                    </div>
                                </div>
                            </div>

                            {own && (
                                <div className="dv2-tree-card-stats">
                                    <div>
                                        <div className="dv2-tree-card-stat-value">
                                            {amount(own.paid, data.currency)}
                                        </div>
                                        <div className="dv2-tree-card-stat-label">
                                            {td("paid")}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="dv2-tree-card-stat-value">
                                            {own.active_deals}
                                        </div>
                                        <div className="dv2-tree-card-stat-label">
                                            {td("active")}
                                        </div>
                                    </div>
                                    {branchDiffers && (
                                        <div
                                            className="dv2-tree-card-branch"
                                            title={td(
                                                "Including everyone below them",
                                            )}
                                        >
                                            {td("branch")}: {network.active_deals}{" "}
                                            {td("deals")}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </foreignObject>
                </g>
            );
        },
        [onSelect, toggle, td],
    );

    if (!data.nodes.length) {
        return (
            <div style={{ padding: 18 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {td("Nobody reports to you yet")}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                    {td(
                        "An agent joins your network when your agent record is set as their parent agent.",
                    )}
                </p>
            </div>
        );
    }

    const containerWidth = containerRef.current?.clientWidth ?? 900;

    return (
        <div
            ref={containerRef}
            style={{
                height,
                background: T.SURFACE_2,
                borderRadius: 8,
            }}
        >
            <Tree
                data={treeData as never}
                orientation="vertical"
                pathFunc="step"
                translate={{ x: containerWidth / 2, y: 80 }}
                separation={{ siblings: 1.1, nonSiblings: 1.3 }}
                nodeSize={{ x: 230, y: 160 }}
                scaleExtent={{ min: 0.15, max: 2 }}
                renderCustomNodeElement={renderNode as never}
                zoom={0.75}
                zoomable
                draggable
                enableLegacyTransitions
                transitionDuration={300}
            />
        </div>
    );
}

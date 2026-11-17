import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import { avatarFill } from "../people/format";
import { joinedRecently } from "./format";
import { ancestors, descendants, layoutTree, outlineRows, type NetworkTree as Tree, type TreeNode } from "./networkTree";

/* Geometry of the branch map (L9-C): one column per generation, one row slot per leaf. */
const LEFT = 20;
const TOP = 48;
const COL_W = 270;
const NODE_W = 236;
const NODE_H = 58;
const ROW_H = 76;
const GAP_MID = (COL_W - NODE_W) / 2;
const CHIP_ROOM = 250;

/* The phone outline (L9-C phone): one row per agent, indented per generation. */
const OUT_TOP = 40;
const OUT_ROW = 54;
const OUT_H = 42;
const OUT_INDENT = 22;

interface NetworkTreeProps {
    tree: Tree;
    pickedId: number | null;
    onPick: (id: number) => void;
    nowMs: number;
    /** Phones get the indented outline instead of the map. */
    compact: boolean;
}

function useNodeText(nowMs: number) {
    const { t } = useTranslation();
    return useCallback(
        (node: TreeNode) => {
            const row = node.row;
            const name = row.name?.trim() || t("pages.agent_workspace.earnings.table.unnamed");
            return {
                name: row.kind === "self" ? t("pages.agent_workspace.earnings.network.tree.you_name", { name }) : name,
                plainName: name,
                level: row.level ?? t("pages.agent_workspace.earnings.network.unranked"),
                ranked: row.level !== null,
                fresh: row.kind === "downline" && joinedRecently(row.joined_at, nowMs, t) !== null,
            };
        },
        [nowMs, t],
    );
}

/** The ids lit up for a pick: the path down from you to them, and their whole visible branch. */
function useHighlight(tree: Tree, pickedId: number | null) {
    return useMemo(() => {
        const lit = new Set<number>();
        const picked = pickedId !== null ? tree.byId.get(pickedId) : undefined;
        if (!picked) return { picked: null, lit };
        lit.add(picked.row.id);
        for (const above of ancestors(picked)) {
            lit.add(above.row.id);
            if (above.row.kind === "self") break;
        }
        for (const below of descendants(picked)) lit.add(below.row.id);
        return { picked, lit };
    }, [tree, pickedId]);
}

/**
 * The Network's tree view (L9-C, the branch map): you and your upline on the
 * left, one column per generation to the right. Picking an agent lights up
 * their branch; any branch folds away. On a phone it reads as an indented
 * outline (L9-C phone).
 */
export default function NetworkTree({ tree, pickedId, onPick, nowMs, compact }: NetworkTreeProps) {
    const { t } = useTranslation();
    const [folded, setFolded] = useState<Set<number>>(() => new Set());
    const [query, setQuery] = useState("");
    const text = useNodeText(nowMs);
    const { picked, lit } = useHighlight(tree, pickedId);

    const toggleFold = useCallback((id: number) => {
        setFolded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const needle = query.trim().toLocaleLowerCase();
    const matches = useMemo(() => {
        if (!needle) return [] as TreeNode[];
        return Array.from(tree.byId.values()).filter((node) => node.row.kind === "downline" && (node.row.name ?? "").toLocaleLowerCase().includes(needle));
    }, [tree, needle]);
    const matchIds = useMemo(() => new Set(matches.map((node) => node.row.id)), [matches]);

    const reveal = (node: TreeNode) => {
        // Unfold everything above the agent, pick them, then bring them into view once drawn.
        setFolded((current) => {
            const next = new Set(current);
            for (const above of ancestors(node)) next.delete(above.row.id);
            return next;
        });
        onPick(node.row.id);
        window.requestAnimationFrame(() => {
            document.getElementById(`agent-tree-node-${node.row.id}`)?.scrollIntoView({
                block: "nearest",
                inline: "center",
                behavior: "smooth",
            });
        });
    };

    const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" && matches.length > 0) {
            event.preventDefault();
            reveal(matches[0]);
        }
    };

    const search = (
        <label className="agent-ea-tree__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
            </svg>
            <input
                type="search"
                aria-label={t("pages.agent_workspace.earnings.network.tree.search_label")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKey}
                placeholder={t("pages.agent_workspace.earnings.network.tree.search")}
            />
        </label>
    );
    const searchNote = needle ? (
        <span className="agent-ea-tree__found" role="status">
            {matches.length === 0
                ? t("pages.agent_workspace.earnings.network.tree.no_match")
                : t(matches.length === 1 ? "pages.agent_workspace.earnings.network.tree.matches_one" : "pages.agent_workspace.earnings.network.tree.matches", { count: matches.length })}
        </span>
    ) : null;

    if (compact) {
        return (
            <PhoneOutline
                tree={tree}
                folded={folded}
                onToggleFold={toggleFold}
                lit={lit}
                pickedId={picked?.row.id ?? null}
                matchIds={matchIds}
                onPick={onPick}
                text={text}
                header={
                    <>
                        {search}
                        {searchNote}
                    </>
                }
            />
        );
    }

    return (
        <BranchMap
            tree={tree}
            folded={folded}
            onToggleFold={toggleFold}
            onExpandAll={() => setFolded(new Set())}
            lit={lit}
            picked={picked}
            matchIds={matchIds}
            onPick={onPick}
            text={text}
            search={search}
            searchNote={searchNote}
        />
    );
}

type NodeText = ReturnType<typeof useNodeText>;

interface BranchMapProps {
    tree: Tree;
    folded: Set<number>;
    onToggleFold: (id: number) => void;
    onExpandAll: () => void;
    lit: Set<number>;
    picked: TreeNode | null;
    matchIds: Set<number>;
    onPick: (id: number) => void;
    text: NodeText;
    search: ReactElement;
    searchNote: ReactElement | null;
}

function BranchMap({ tree, folded, onToggleFold, onExpandAll, lit, picked, matchIds, onPick, text, search, searchNote }: BranchMapProps) {
    const { t } = useTranslation();
    const layout = useMemo(() => layoutTree(tree, folded), [tree, folded]);

    const x = (col: number) => LEFT + col * COL_W;
    const cy = (row: number) => TOP + row * ROW_H + NODE_H / 2;
    const width = LEFT + layout.cols * COL_W + CHIP_ROOM;
    const height = TOP + Math.max(layout.rows, 1) * ROW_H + 4;

    // Column headings: upline and you, then a generation per column with how many agents it holds.
    const selfCol = tree.self ? (layout.byId.get(tree.self.row.id)?.col ?? 0) : 0;
    const heads = Array.from(
        {
            length: Math.max(layout.cols, selfCol + 1 + tree.generations.length),
        },
        (_, col) => {
            if (col < selfCol)
                return {
                    title: t("pages.agent_workspace.earnings.network.tree.col_upline"),
                    count: "",
                };
            if (col === selfCol)
                return {
                    title: t("pages.agent_workspace.earnings.network.tree.col_you"),
                    count: "",
                };
            const generation = col - selfCol;
            const count = tree.generations[generation - 1] ?? 0;
            return {
                title: t("pages.agent_workspace.earnings.network.tree.col_generation", { n: generation }),
                count: t(count === 1 ? "pages.agent_workspace.earnings.network.tree.col_count_one" : "pages.agent_workspace.earnings.network.tree.col_count", { count }),
            };
        },
    ).slice(0, layout.cols);

    // The picked branch: a band behind it and its totals beside it.
    const pickedPlace = picked ? layout.byId.get(picked.row.id) : undefined;
    let band: {
        left: number;
        top: number;
        width: number;
        height: number;
    } | null = null;
    let chip: {
        left: number;
        top: number;
        agents: number;
        sales: number;
    } | null = null;
    if (picked && pickedPlace && !pickedPlace.folded && picked.children.length > 0) {
        const below = descendants(picked);
        const shown = below.map((node) => layout.byId.get(node.row.id)).filter((entry): entry is NonNullable<typeof entry> => !!entry);
        const rows = [pickedPlace.row, ...shown.map((entry) => entry.row)];
        const lastCol = Math.max(pickedPlace.col, ...shown.map((entry) => entry.col));
        const top = TOP + Math.min(...rows) * ROW_H - 10;
        const bottom = TOP + Math.max(...rows) * ROW_H + NODE_H + 10;
        band = {
            left: x(pickedPlace.col) - 12,
            top,
            width: x(lastCol) + NODE_W + 12 - (x(pickedPlace.col) - 12),
            height: bottom - top,
        };
        chip = {
            left: x(lastCol) + NODE_W + 40,
            top: cy(pickedPlace.row) - 26,
            agents: below.length,
            sales: [picked, ...below].reduce((sum, node) => sum + node.row.nsa, 0),
        };
    }

    // When the map is wider than the card, open it at your column: the upline is one scroll away.
    const scroller = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const el = scroller.current;
        if (el && LEFT + layout.cols * COL_W > el.clientWidth) el.scrollLeft = x(selfCol) - LEFT;
        // Only on first draw; after that the scroll is the person's.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reading order for the buttons, so Tab walks the tree the way it reads.
    const order: TreeNode[] = [];
    const walk = (node: TreeNode) => {
        if (!layout.byId.has(node.row.id)) return;
        order.push(node);
        node.children.forEach(walk);
    };
    if (tree.root) walk(tree.root);

    return (
        <section className="agent-ea-tree" aria-label={t("pages.agent_workspace.earnings.network.tree.label")}>
            <div className="agent-ea-tree__bar">
                <span className="agent-ea-tree__hint">{t("pages.agent_workspace.earnings.network.tree.hint")}</span>
                {searchNote}
                {search}
                <button type="button" className="agent-ea-tree__btn" onClick={onExpandAll} disabled={folded.size === 0}>
                    {t("pages.agent_workspace.earnings.network.tree.expand_all")}
                </button>
            </div>
            <div ref={scroller} className="agent-ea-tree__scroll">
                <div className="agent-ea-tree__canvas" style={{ width, height }}>
                    {heads.map((head, col) => (
                        <span key={col} className="agent-ea-tree__col" style={{ left: x(col) }}>
                            <span className="agent-ea__cap">{head.title}</span>
                            {head.count ? <span className="agent-ea-tree__count">{head.count}</span> : null}
                        </span>
                    ))}

                    {band ? <span className="agent-ea-tree__band" style={band} aria-hidden="true" /> : null}

                    <svg className="agent-ea-tree__lines" width={width} height={height} aria-hidden="true">
                        {layout.placed.map(({ node, col, row }) => {
                            const parent = node.parent ? layout.byId.get(node.parent.row.id) : undefined;
                            if (!parent) return null;
                            const x1 = x(parent.col) + NODE_W;
                            const x2 = x(col);
                            const y1 = cy(parent.row);
                            const y2 = cy(row);
                            if (parent.node.row.kind === "upline") {
                                return <path key={node.row.id} d={`M${x1} ${y2}H${x2}`} className="agent-ea-tree__line is-dashed" />;
                            }
                            const xm = x1 + GAP_MID;
                            const on = lit.has(node.row.id) && lit.has(parent.node.row.id);
                            return <path key={node.row.id} d={`M${x1} ${y1}H${xm}V${y2}H${x2}`} className={`agent-ea-tree__line${on ? " is-lit" : ""}`} />;
                        })}
                    </svg>

                    {order.map((node) => {
                        const place = layout.byId.get(node.row.id)!;
                        const words = text(node);
                        const kind = node.row.kind;
                        const isPicked = picked?.row.id === node.row.id;
                        const style = {
                            left: x(place.col),
                            top: cy(place.row) - NODE_H / 2,
                            width: NODE_W,
                            height: NODE_H,
                        };
                        const inner = (
                            <>
                                <span
                                    className="agent-ea__avatar agent-ea-tree__avatar"
                                    style={{
                                        ["--fill" as string]: avatarFill(node.row.id),
                                    }}
                                    aria-hidden="true"
                                >
                                    {initialsFromName(words.plainName)}
                                </span>
                                <span className="agent-ea-tree__who">
                                    <b>{words.name}</b>
                                    <span className="agent-ea-tree__tags">
                                        <span className={`agent-ea-tree__level${words.ranked ? "" : " is-unranked"}`}>{words.level}</span>
                                        {words.fresh ? <span className="agent-ea-tree__fresh">{t("pages.agent_workspace.earnings.network.tree.new_agent")}</span> : null}
                                    </span>
                                </span>
                                <span className="agent-ea-tree__nums">
                                    <b>
                                        {node.row.nsa}
                                        <span> / </span>
                                        {node.row.nsd}
                                    </b>
                                    <span>{t("pages.agent_workspace.earnings.network.tree.numbers")}</span>
                                </span>
                            </>
                        );
                        const cls = `agent-ea-tree__node agent-ea-tree__node--${kind}${isPicked ? " is-picked" : ""}${matchIds.has(node.row.id) ? " is-match" : ""}`;

                        return (
                            <Fragment key={node.row.id}>
                                {kind === "downline" ? (
                                    <button type="button" id={`agent-tree-node-${node.row.id}`} className={cls} style={style} aria-pressed={isPicked} onClick={() => onPick(node.row.id)}>
                                        {inner}
                                    </button>
                                ) : (
                                    <div id={`agent-tree-node-${node.row.id}`} className={cls} style={style}>
                                        {inner}
                                    </div>
                                )}
                                {kind !== "upline" && node.children.length > 0 ? (
                                    <FoldButton
                                        left={x(place.col) + NODE_W + GAP_MID}
                                        top={cy(place.row)}
                                        folded={place.folded}
                                        count={descendants(node).length}
                                        name={words.plainName}
                                        onClick={() => onToggleFold(node.row.id)}
                                    />
                                ) : null}
                            </Fragment>
                        );
                    })}

                    {chip && picked ? (
                        <span className="agent-ea-tree__chip" style={{ left: chip.left, top: chip.top }}>
                            <span className="agent-ea__cap">{t("pages.agent_workspace.earnings.network.tree.branch_title", { name: text(picked).plainName })}</span>
                            <span>
                                {t(chip.agents === 1 ? "pages.agent_workspace.earnings.network.tree.branch_agents_one" : "pages.agent_workspace.earnings.network.tree.branch_agents", { count: chip.agents })}
                                {" · "}
                                {t(chip.sales === 1 ? "pages.agent_workspace.earnings.network.tree.branch_sales_one" : "pages.agent_workspace.earnings.network.tree.branch_sales", { count: chip.sales })}
                            </span>
                        </span>
                    ) : null}
                </div>
            </div>
        </section>
    );
}

interface FoldButtonProps {
    left: number;
    top: number;
    folded: boolean;
    count: number;
    name: string;
    onClick: () => void;
}

function FoldButton({ left, top, folded, count, name, onClick }: FoldButtonProps) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            className={`agent-ea-tree__fold${folded ? " is-folded" : ""}`}
            style={{ left, top }}
            aria-expanded={!folded}
            aria-label={
                folded
                    ? t("pages.agent_workspace.earnings.network.tree.unfold", {
                          name,
                          count,
                      })
                    : t("pages.agent_workspace.earnings.network.tree.fold", {
                          name,
                      })
            }
            onClick={onClick}
        >
            {folded ? `+${count}` : "−"}
        </button>
    );
}

interface PhoneOutlineProps {
    tree: Tree;
    folded: Set<number>;
    onToggleFold: (id: number) => void;
    lit: Set<number>;
    pickedId: number | null;
    matchIds: Set<number>;
    onPick: (id: number) => void;
    text: NodeText;
    header: ReactElement;
}

function PhoneOutline({ tree, folded, onToggleFold, lit, pickedId, matchIds, onPick, text, header }: PhoneOutlineProps) {
    const { t } = useTranslation();
    const rows = useMemo(() => outlineRows(tree, folded), [tree, folded]);
    const height = OUT_TOP + rows.length * OUT_ROW;

    return (
        <section className="agent-ea-tree agent-ea-tree--outline" aria-label={t("pages.agent_workspace.earnings.network.tree.label")}>
            <div className="agent-ea-tree__bar">{header}</div>
            <div className="agent-ea-tree__outline" style={{ height }}>
                <div className="agent-ea-tree__outline-head">
                    <span className="agent-ea__cap">{t("pages.agent_workspace.earnings.network.tree.branches")}</span>
                    <span className="agent-ea-tree__count">{t("pages.agent_workspace.earnings.network.tree.numbers")}</span>
                </div>
                <svg className="agent-ea-tree__lines" width="100%" height={height} aria-hidden="true">
                    {rows.map(({ node, depth, parentIndex }, index) => {
                        if (parentIndex === null) return null;
                        const parentDepth = rows[parentIndex].depth;
                        const lx = 12 + parentDepth * OUT_INDENT + 14;
                        const py = OUT_TOP + parentIndex * OUT_ROW + OUT_H;
                        const y = OUT_TOP + index * OUT_ROW + OUT_H / 2;
                        const on = lit.has(node.row.id) && lit.has(rows[parentIndex].node.row.id);
                        return <path key={node.row.id} d={`M${lx} ${py}V${y}H${12 + depth * OUT_INDENT}`} className={`agent-ea-tree__line${on ? " is-lit" : ""}`} />;
                    })}
                </svg>
                {rows.map(({ node, depth }, index) => {
                    const words = text(node);
                    const kind = node.row.kind;
                    const isPicked = pickedId === node.row.id;
                    const left = 12 + depth * OUT_INDENT;
                    const hasKids = node.children.length > 0;
                    const isFolded = folded.has(node.row.id);
                    const cls = `agent-ea-tree__node agent-ea-tree__node--${kind} agent-ea-tree__row${isPicked ? " is-picked" : ""}${matchIds.has(node.row.id) ? " is-match" : ""}`;
                    const style = {
                        left,
                        right: hasKids ? 52 : 12,
                        top: OUT_TOP + index * OUT_ROW,
                        height: OUT_H,
                    };
                    const inner = (
                        <>
                            <span
                                className="agent-ea__avatar agent-ea-tree__avatar agent-ea-tree__avatar--sm"
                                style={{
                                    ["--fill" as string]: avatarFill(node.row.id),
                                }}
                                aria-hidden="true"
                            >
                                {initialsFromName(words.plainName)}
                            </span>
                            <span className="agent-ea-tree__who">
                                <b>{words.name}</b>
                                <span className="agent-ea-tree__sub">
                                    {words.level}
                                    {words.fresh ? <span className="agent-ea-tree__fresh"> · {t("pages.agent_workspace.earnings.network.tree.new_agent")}</span> : null}
                                </span>
                            </span>
                            <b className="agent-ea-tree__pair">
                                {node.row.nsa}
                                <span> / </span>
                                {node.row.nsd}
                            </b>
                        </>
                    );
                    return (
                        <Fragment key={node.row.id}>
                            {kind === "downline" ? (
                                <button type="button" id={`agent-tree-node-${node.row.id}`} className={cls} style={style} aria-pressed={isPicked} onClick={() => onPick(node.row.id)}>
                                    {inner}
                                </button>
                            ) : (
                                <div id={`agent-tree-node-${node.row.id}`} className={cls} style={style}>
                                    {inner}
                                </div>
                            )}
                            {hasKids ? (
                                <button
                                    type="button"
                                    className={`agent-ea-tree__fold agent-ea-tree__fold--row${isFolded ? " is-folded" : ""}`}
                                    style={{
                                        top: OUT_TOP + index * OUT_ROW + OUT_H / 2,
                                    }}
                                    aria-expanded={!isFolded}
                                    aria-label={
                                        isFolded
                                            ? t("pages.agent_workspace.earnings.network.tree.unfold", {
                                                  name: words.plainName,
                                                  count: descendants(node).length,
                                              })
                                            : t("pages.agent_workspace.earnings.network.tree.fold", { name: words.plainName })
                                    }
                                    onClick={() => onToggleFold(node.row.id)}
                                >
                                    {isFolded ? `+${descendants(node).length}` : "−"}
                                </button>
                            ) : null}
                        </Fragment>
                    );
                })}
            </div>
        </section>
    );
}

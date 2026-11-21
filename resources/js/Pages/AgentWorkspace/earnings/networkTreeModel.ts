import type { NetworkRow } from "./types";

/** One agent in the tree, with the agents directly under them. */
export interface TreeNode {
    row: NetworkRow;
    parent: TreeNode | null;
    children: TreeNode[];
}

export interface NetworkTree {
    /** The upline, else the agent: where the tree starts. */
    root: TreeNode | null;
    self: TreeNode | null;
    byId: Map<number, TreeNode>;
    /** Agents below the viewer, by generation (1 = brought in directly). */
    generations: number[];
}

/**
 * Hangs the network rows under their parents. Rows come in the order the tree
 * reads (upline, you, then each branch depth-first); a row whose parent is not
 * in the payload hangs off the row before it at a shallower depth, so a
 * truncated payload still draws as a tree.
 */
export function buildNetworkTree(rows: NetworkRow[]): NetworkTree {
    const byId = new Map<number, TreeNode>();
    const generations: number[] = [];
    let root: TreeNode | null = null;
    let self: TreeNode | null = null;
    const stack: TreeNode[] = [];

    for (const row of rows) {
        const node: TreeNode = { row, parent: null, children: [] };
        byId.set(row.id, node);

        while (stack.length > 0 && stack[stack.length - 1].row.depth >= row.depth) stack.pop();
        const parent = (row.parent_id !== null ? byId.get(row.parent_id) : undefined) ?? (row.kind === "upline" ? undefined : stack[stack.length - 1]);

        if (parent) {
            node.parent = parent;
            parent.children.push(node);
        } else if (!root) {
            root = node;
        }
        if (row.kind === "self") self = node;
        if (row.kind === "downline" && row.generation > 0) generations[row.generation - 1] = (generations[row.generation - 1] ?? 0) + 1;
        stack.push(node);
    }

    return {
        root,
        self,
        byId,
        generations: Array.from(generations, (count) => count ?? 0),
    };
}

/** Everyone under a node, however deep. */
export function descendants(node: TreeNode): TreeNode[] {
    const out: TreeNode[] = [];
    const walk = (at: TreeNode) => {
        for (const child of at.children) {
            out.push(child);
            walk(child);
        }
    };
    walk(node);
    return out;
}

/** The node and everyone above it, closest first. */
export function ancestors(node: TreeNode): TreeNode[] {
    const out: TreeNode[] = [];
    for (let at = node.parent; at; at = at.parent) out.push(at);
    return out;
}

export interface PlacedNode {
    node: TreeNode;
    /** Column: the upline is 0, you are next, then one column per generation. */
    col: number;
    /** Row slot; a parent sits halfway between its first and last child, so it can be fractional. */
    row: number;
    folded: boolean;
}

export interface TreeLayout {
    placed: PlacedNode[];
    byId: Map<number, PlacedNode>;
    cols: number;
    rows: number;
}

/**
 * Places every visible node: each leaf (or folded branch) takes the next row,
 * and a parent is centred on its children. Folded nodes hide what is under them.
 */
export function layoutTree(tree: NetworkTree, folded: ReadonlySet<number>): TreeLayout {
    const placed: PlacedNode[] = [];
    const byId = new Map<number, PlacedNode>();
    let nextRow = 0;
    let maxCol = 0;

    const place = (node: TreeNode, col: number): number => {
        const isFolded = folded.has(node.row.id) && node.children.length > 0;
        let row: number;
        if (node.children.length === 0 || isFolded) {
            row = nextRow++;
        } else {
            const rowsBelow = node.children.map((child) => place(child, col + 1));
            row = (rowsBelow[0] + rowsBelow[rowsBelow.length - 1]) / 2;
        }
        const entry: PlacedNode = { node, col, row, folded: isFolded };
        placed.push(entry);
        byId.set(node.row.id, entry);
        maxCol = Math.max(maxCol, col);
        return row;
    };

    if (tree.root) place(tree.root, 0);

    return { placed, byId, cols: maxCol + 1, rows: nextRow };
}

/** The visible nodes in reading order with their depth, for the phone outline. */
export function outlineRows(tree: NetworkTree, folded: ReadonlySet<number>): Array<{ node: TreeNode; depth: number; parentIndex: number | null }> {
    const out: Array<{
        node: TreeNode;
        depth: number;
        parentIndex: number | null;
    }> = [];
    const walk = (node: TreeNode, depth: number, parentIndex: number | null) => {
        const index = out.length;
        out.push({ node, depth, parentIndex });
        if (folded.has(node.row.id)) return;
        for (const child of node.children) walk(child, depth + 1, index);
    };
    // The phone outline starts at you; the upline is named in the header line instead.
    if (tree.self) walk(tree.self, 0, null);
    return out;
}

import { createElement, type ReactNode } from "react";

/** Escapes user text before it goes into the stored comment HTML. */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const MENTION_PATTERN = /@\[([^\]]+)]\((\d+)\)/g;

/**
 * Renders a stored comment. Mentions were written as `@[Name](id)` markers, so
 * everything else stays plain text and only the markers become highlighted
 * chips — comment bodies are never injected as raw HTML.
 */
export function renderComment(comment: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    const pattern = new RegExp(MENTION_PATTERN.source, "g");
    let match = pattern.exec(comment);
    while (match !== null) {
        if (match.index > lastIndex) {
            nodes.push(comment.slice(lastIndex, match.index));
        }
        nodes.push(
            createElement(
                "span",
                {
                    key: `${match.index}-${match[2]}`,
                    className: "tasks-mention",
                },
                `@${match[1]}`,
            ),
        );
        lastIndex = match.index + match[0].length;
        match = pattern.exec(comment);
    }
    if (lastIndex < comment.length) {
        nodes.push(comment.slice(lastIndex));
    }
    return nodes;
}

/** Pulls the mentioned user ids back out of a composed comment. */
export function extractMentionIds(comment: string): number[] {
    const ids = new Set<number>();
    const pattern = new RegExp(MENTION_PATTERN.source, "g");
    let match = pattern.exec(comment);
    while (match !== null) {
        ids.add(Number(match[2]));
        match = pattern.exec(comment);
    }
    return Array.from(ids);
}

const MENTION_CHIP_CLASS = "tasks-mention";

/**
 * Reads a mention composer's DOM back into the stored `@[Name](id)` plain-text
 * format — the inverse of the chip a mention becomes once inserted (see
 * `insertMentionChip`). Kept in sync with `renderComment`'s marker format so
 * the same string round-trips through both.
 */
export function serializeMentionEditor(root: Node): string {
    let out = "";
    root.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            out += child.textContent ?? "";
            return;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const el = child as HTMLElement;
        if (el.tagName === "BR") {
            out += "\n";
        } else if (el.dataset.mentionId && el.dataset.mentionName) {
            out += `@[${el.dataset.mentionName}](${el.dataset.mentionId})`;
        } else {
            out += serializeMentionEditor(el);
        }
    });
    return out;
}

/**
 * Text from the start of the composer up to the current caret, with any
 * mention chips re-expanded to their `@[Name](id)` form — lets the existing
 * `@query` detection (built for a plain string + caret offset) work unchanged
 * against a contentEditable composer.
 */
export function textBeforeCaret(root: HTMLElement): string {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !root.contains(selection.getRangeAt(0).endContainer)) {
        return serializeMentionEditor(root);
    }
    const range = selection.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(root);
    preRange.setEnd(range.endContainer, range.endOffset);
    return serializeMentionEditor(preRange.cloneContents());
}

/**
 * Inserts a mention chip identical in markup to the one `renderComment`
 * renders for a posted comment, so a mention looks the same while composing
 * and once sent. Assumes the caret sits inside a text node containing the
 * just-typed `@query` (true for normal typing — see TaskCommentsPanel).
 */
export function insertMentionChip(
    range: Range,
    person: { id: number; name: string },
): boolean {
    const node = range.endContainer;
    if (node.nodeType !== Node.TEXT_NODE) return false;
    const text = node.textContent ?? "";
    const at = text.lastIndexOf("@", range.endOffset - 1);
    if (at === -1) return false;
    const parent = node.parentNode;
    if (!parent) return false;

    const chip = document.createElement("span");
    chip.className = MENTION_CHIP_CLASS;
    chip.contentEditable = "false";
    chip.dataset.mentionId = String(person.id);
    chip.dataset.mentionName = person.name;
    chip.textContent = `@${person.name}`;

    const afterNode = document.createTextNode(text.slice(range.endOffset));
    const spaceNode = document.createTextNode(" ");
    node.textContent = text.slice(0, at);
    parent.insertBefore(afterNode, node.nextSibling);
    parent.insertBefore(spaceNode, afterNode);
    parent.insertBefore(chip, spaceNode);

    const selection = window.getSelection();
    if (selection) {
        const caret = document.createRange();
        caret.setStart(spaceNode, 1);
        caret.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caret);
    }
    return true;
}

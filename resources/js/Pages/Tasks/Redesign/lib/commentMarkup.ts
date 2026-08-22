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

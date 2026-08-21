/** Escapes user text before it goes into the stored comment HTML. */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Renders a stored comment. Mentions were written as `@[Name](id)` markers, so
 * everything else is escaped and only the markers become highlighted chips —
 * comment bodies are never injected as raw HTML.
 */
export function renderComment(comment: string): string {
    return escapeHtml(comment).replace(
        /@\[([^\]]+)]\((\d+)\)/g,
        (_match, name: string) => `<span class="tasks-mention">@${name}</span>`,
    );
}

/** Pulls the mentioned user ids back out of a composed comment. */
export function extractMentionIds(comment: string): number[] {
    const ids = new Set<number>();
    const pattern = /@\[[^\]]+]\((\d+)\)/g;
    let match = pattern.exec(comment);
    while (match !== null) {
        ids.add(Number(match[1]));
        match = pattern.exec(comment);
    }
    return Array.from(ids);
}

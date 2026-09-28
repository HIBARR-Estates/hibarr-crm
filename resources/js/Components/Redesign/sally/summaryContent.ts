import { marked } from "marked";
import DOMPurify from "dompurify";

const HTML_TAG = /<\/?[a-z][\s\S]*>/i;
const MARKDOWN = /(\*\*[^*]+\*\*|^\s*[-*+]\s|^\s*#{1,6}\s|^\s*>\s|\[[^\]]+\]\([^)]+\))/m;

export type SummaryShape = "html" | "markdown" | "text";

/**
 * Older rows were stored with Sally's escapes left literal, so a summary can
 * arrive containing the two characters `\n` instead of a real newline. Decode
 * those on read so every consumer — renderer, editor, comparison — sees real
 * line breaks regardless of whether the row has been re-synced since.
 */
export function normalizeSummary(raw: string | null | undefined): string {
    if (!raw) {
        return "";
    }

    if (!raw.includes("\\")) {
        return raw;
    }

    return raw
        .replace(/\\r\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\n")
        .replace(/\\t/g, " ");
}

/** Which renderer a summary needs. */
export function summaryShape(raw: string): SummaryShape {
    if (HTML_TAG.test(raw)) {
        return "html";
    }

    if (MARKDOWN.test(raw)) {
        return "markdown";
    }

    return "text";
}

/**
 * Markdown → sanitized HTML, for feeding the rich-text editor. Plain text is
 * passed through marked too (it becomes paragraphs), so a summary written
 * without any formatting still opens in the editor as real paragraphs rather
 * than one run-on line.
 */
export function summaryToEditorHtml(
    raw: string | null | undefined,
): string {
    const normalized = normalizeSummary(raw);

    if (!normalized) {
        return "";
    }

    if (HTML_TAG.test(normalized)) {
        return normalized;
    }

    const html = marked.parse(normalized, {
        breaks: true,
        gfm: true,
    }) as string;

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            "p",
            "br",
            "strong",
            "b",
            "em",
            "i",
            "u",
            "s",
            "h1",
            "h2",
            "h3",
            "h4",
            "blockquote",
            "ul",
            "ol",
            "li",
            "a",
            "span",
            "div",
            "code",
            "pre",
        ],
        ALLOWED_ATTR: ["href", "target"],
        ALLOW_DATA_ATTR: false,
    });
}

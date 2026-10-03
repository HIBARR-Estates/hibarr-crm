import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
// Imported here as well as in ContentRenderer: the .markdown-content rules
// live in this stylesheet, and callers may use this component standalone.
import "./ContentRenderer.css";

interface MarkdownRendererProps {
    content: string;
    className?: string;
    maxLength?: number;
    showFullContent?: boolean;
}

// Hooks are global to the shared DOMPurify instance and accumulate, so this
// is registered once at module scope — before any sanitize call — instead of
// inside the render body, where every render added another copy and the very
// first output was sanitized before the hook existed.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // A sanitized markdown link with target="_blank" would otherwise hand the
    // new tab a window.opener reference back to this one.
    if (
        node.tagName === "A" &&
        node.getAttribute("target") === "_blank" &&
        !node.getAttribute("rel")
    ) {
        node.setAttribute("rel", "noopener noreferrer");
    }
});

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    className = "",
    maxLength,
    showFullContent = false,
}) => {
    // Configure marked options
    marked.setOptions({
        breaks: true, // Convert line breaks to <br>
        gfm: true, // GitHub Flavored Markdown
        silent: true, // Don't throw on error
    });

    // Truncate markdown content if maxLength is specified and not showing full content
    let displayContent = content;

    if (maxLength && !showFullContent) {
        if (content.length > maxLength) {
            // Find the last complete word within the limit
            const truncated = content.substring(0, maxLength);
            const lastSpaceIndex = truncated.lastIndexOf(" ");
            displayContent =
                lastSpaceIndex > 0
                    ? truncated.substring(0, lastSpaceIndex) + "..."
                    : truncated + "...";
        }
    }

    // Convert markdown to HTML, then sanitize.
    const htmlContent = marked.parse(displayContent) as string;

    const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
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
            "h5",
            "h6",
            "ul",
            "ol",
            "li",
            "blockquote",
            "a",
            "span",
            "div",
            "code",
            "pre",
            "table",
            "thead",
            "tbody",
            "tr",
            "td",
            "th",
            "hr",
        ],
        ALLOWED_ATTR: ["href", "target", "src", "alt", "title", "class", "rel"],
        ALLOW_DATA_ATTR: false,
        // target="_blank" without rel hands the new tab a window.opener
        // reference back to this one; DOMPurify drops noopener on its own.
        ADD_ATTR: ["target"],
        ADD_TAGS: [],
        // Summary content is LLM-generated from meeting transcripts, so a
        // prompt-injected transcript can emit a remote URL. Forbid img here
        // to match the server-side purifier: without it the browser fetches
        // attacker-controlled URLs (and their query strings) on render.
        FORBID_TAGS: ["style", "img"],
        FORBID_ATTR: ["style"],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });

    return (
        <div
            className={`markdown-content ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            style={{
                lineHeight: "1.6",
                wordBreak: "break-word",
            }}
        />
    );
};

export default MarkdownRenderer;

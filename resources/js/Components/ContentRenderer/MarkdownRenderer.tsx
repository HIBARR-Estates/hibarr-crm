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
            "img",
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
        ALLOWED_ATTR: ["href", "target", "src", "alt", "title", "class"],
        ALLOW_DATA_ATTR: false,
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

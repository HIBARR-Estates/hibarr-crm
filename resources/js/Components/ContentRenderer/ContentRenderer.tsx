import React from "react";
import HtmlRenderer from "./HtmlRenderer";
import MarkdownRenderer from "./MarkdownRenderer";
import "./ContentRenderer.css";

export type ContentType = "html" | "markdown" | "text";

interface ContentRendererProps {
    content: string;
    className?: string;
    maxLength?: number;
    showFullContent?: boolean;
    onClick?: () => void;
    style?: React.CSSProperties;
}

// Utility function to detect content type
const detectContentType = (content: string): ContentType => {
    if (!content || typeof content !== "string") {
        return "text";
    }

    const trimmedContent = content.trim();

    // Check for HTML tags
    const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;
    const hasHtmlTags = htmlTagRegex.test(trimmedContent);

    // Check for common markdown patterns
    const markdownPatterns = [
        /^#{1,6}\s/, // Headers
        /\*\*.*\*\*/, // Bold
        /\*.*\*/, // Italic
        /\[.*\]\(.*\)/, // Links
        /^[\s]*[-*+]\s/, // Unordered lists
        /^\d+\.\s/, // Ordered lists
        /```/, // Code blocks
        /`.*`/, // Inline code
        /^>/, // Blockquotes
        /\|.*\|/, // Tables
    ];

    const hasMarkdownSyntax = markdownPatterns.some((pattern) =>
        pattern.test(trimmedContent)
    );

    // Prioritize HTML detection over markdown
    if (hasHtmlTags) {
        return "html";
    }

    if (hasMarkdownSyntax) {
        return "markdown";
    }

    return "text";
};

const ContentRenderer: React.FC<ContentRendererProps> = ({
    content,
    className = "",
    maxLength,
    showFullContent = false,
    onClick,
    style = {},
}) => {
    if (!content) {
        return (
            <span className={`text-gray-400 italic ${className}`}>
                No content
            </span>
        );
    }

    const contentType = detectContentType(content);

    // Handle plain text
    if (contentType === "text") {
        let displayText = content;

        if (maxLength && !showFullContent && content.length > maxLength) {
            const truncated = content.substring(0, maxLength);
            const lastSpaceIndex = truncated.lastIndexOf(" ");
            displayText =
                lastSpaceIndex > 0
                    ? truncated.substring(0, lastSpaceIndex) + "..."
                    : truncated + "...";
        }

        return (
            <span
                className={`text-content ${className} ${
                    onClick ? "cursor-pointer hover:text-blue-600" : ""
                }`}
                onClick={onClick}
                style={{
                    lineHeight: "1.5",
                    wordBreak: "break-word",
                    ...style,
                }}
            >
                {displayText}
            </span>
        );
    }

    // Handle HTML content
    if (contentType === "html") {
        return (
            <div
                className={onClick ? "cursor-pointer hover:opacity-80" : ""}
                onClick={onClick}
                style={style}
            >
                <HtmlRenderer
                    content={content}
                    className={className}
                    maxLength={maxLength}
                    showFullContent={showFullContent}
                />
            </div>
        );
    }

    // Handle Markdown content
    if (contentType === "markdown") {
        return (
            <div
                className={onClick ? "cursor-pointer hover:opacity-80" : ""}
                onClick={onClick}
                style={style}
            >
                <MarkdownRenderer
                    content={content}
                    className={className}
                    maxLength={maxLength}
                    showFullContent={showFullContent}
                />
            </div>
        );
    }

    return null;
};

export default ContentRenderer;
export { detectContentType };

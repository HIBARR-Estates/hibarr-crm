import DOMPurify from "dompurify";
import {
    stripHtmlTags,
    toQualificationHtml,
} from "./qualificationUtils";

interface QualificationScriptHtmlProps {
    /** Already token-resolved script text (may include OL HTML). */
    html: string;
    className?: string;
    /** When true, wrap visually as a spoken script prompt. */
    quoted?: boolean;
}

const ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
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
];

const ALLOWED_ATTR = ["href", "target", "rel", "class", "title"];

/**
 * Renders OL qualification script bodies as sanitized rich text.
 * Callers should pass text already run through `resolveTokens` / `translateScript`.
 */
export default function QualificationScriptHtml({
    html,
    className = "",
    quoted = false,
}: QualificationScriptHtmlProps) {
    const prepared = toQualificationHtml(html);
    const sanitized = DOMPurify.sanitize(prepared, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
    });

    if (!stripHtmlTags(sanitized)) {
        return null;
    }

    return (
        <div
            className={`qualification-script-html${quoted ? " is-quoted" : ""}${
                className ? ` ${className}` : ""
            }`}
            dangerouslySetInnerHTML={{ __html: sanitized }}
        />
    );
}

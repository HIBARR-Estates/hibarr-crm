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
    "s",
    "strike",
    "del",
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

// `style` is needed for alignment (most rich-text editors, including OL's,
// emit `text-align` as inline style or a `ql-align-*` class — both are
// covered here, see the matching CSS in lead-redesign.css).
const ALLOWED_ATTR = ["href", "target", "rel", "class", "title", "style"];

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

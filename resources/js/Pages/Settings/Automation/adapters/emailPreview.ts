/**
 * Client-side email preview rendering — mirrors EmailTemplate.php /
 * mail.deal-automation-template.blade.php exactly (same wrapper markup, same
 * "complete document" rule, same sample-tag guessing) but computed entirely
 * in the browser: no debounce, no network round-trip, no server-side
 * validation/500 in the way of what you're typing. Matches how Brevo/Plunk/
 * Resend's own template editors preview raw HTML — instantly, from the exact
 * bytes you wrote, in an iframe.
 *
 * Real sends still render server-side via DealAutomationTemplateEmail /
 * mail.deal-automation-template.blade.php — this module only feeds the
 * editor's live preview pane. Keep both in sync if either changes.
 */

const COMPLETE_DOCUMENT_RE = /<!DOCTYPE\s+html|<html[\s>]/i;

/** Whether $html is already a full HTML document (not just a fragment). */
export function bodyIsCompleteHtmlDocument(html: string): boolean {
    return COMPLETE_DOCUMENT_RE.test(html);
}

/** A believable sample value for one merge tag, guessed from its name. */
export function sampleValueFor(tag: string): string {
    const t = tag.toLowerCase();
    const contains = (needles: string[]) => needles.some((n) => t.includes(n));

    if (contains(["url", "link", "cta"])) return "https://example.com/view";
    if (contains(["email"])) return "jane.doe@example.com";
    if (contains(["mobile", "phone", "cell", "office", "whatsapp", "telegram"])) return "+49 151 234 5678";
    if (contains(["instagram", "website"])) return "@janedoe";

    if (contains(["date", "_at", "day"])) {
        return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    if (contains(["time"]) && !contains(["timeline"])) {
        return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }

    if (contains(["name"])) {
        if (contains(["assignedby", "agent", "owner", "user", "author"])) return "Mark Taylor";
        return contains(["company"]) ? "Doe Properties Ltd." : "Jane Doe";
    }

    if (contains(["value", "price", "budget", "amount", "deposit", "payment"])) return "€250,000";
    if (contains(["count", "days_ago", "age", "number"])) return "3";
    if (contains(["country"])) return "Germany";
    if (contains(["city"])) return "Berlin";

    if (contains(["status", "stage", "temperature", "type", "source", "gender"])) {
        return titleCase(tag);
    }

    return titleCase(tag);
}

function titleCase(tag: string): string {
    return tag
        .replace(/_/g, " ")
        .split(" ")
        .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
        .join(" ");
}

const MERGE_TAG_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Replace every {{tag}} in $text with a realistic sample value. */
export function resolveSampleTags(text: string): string {
    if (!text) return text;
    return text.replace(MERGE_TAG_RE, (_match, tag: string) => sampleValueFor(tag));
}

const PREHEADER_MAX_CHARS = 90;
const PREHEADER_PAD_UNITS = 120;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/** Brevo-style hidden inbox preview text — mirrors App\Support\MailPreheader. */
function buildPreheaderHtml(preheader: string | null | undefined): string {
    if (!preheader) return "";

    let text = preheader.replace(/<br\s*\/?>|<\/p>|<\/div>/gi, " ");
    text = text.replace(/<[^>]*>/g, "");
    text = text.replace(/^#+\s*/gm, "");
    text = text.replace(/\s+/g, " ").trim();

    if (text === "") return "";
    if (text.length > PREHEADER_MAX_CHARS) text = text.slice(0, PREHEADER_MAX_CHARS);

    const pad = "&nbsp;&zwnj;".repeat(PREHEADER_PAD_UNITS);

    return (
        '<div style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;color:#eef2f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">' +
        escapeHtml(text) +
        pad +
        "</div>"
    );
}

interface BuildPreviewHtmlArgs {
    subject: string;
    preheader?: string | null;
    body: string;
    mode: "custom" | "plunk_body";
}

/** Full preview document for a template's Subject/Preheader/Body — same
 * wrapper rules as mail.deal-automation-template.blade.php's render() path. */
export function buildPreviewHtml({ subject, preheader, body, mode }: BuildPreviewHtmlArgs): string {
    const resolvedSubject = resolveSampleTags(subject ?? "");
    const resolvedPreheader = resolveSampleTags(preheader ?? "");
    const resolvedBody = resolveSampleTags(body ?? "");

    if (bodyIsCompleteHtmlDocument(resolvedBody)) {
        return resolvedBody;
    }

    const banner =
        mode === "plunk_body"
            ? `<table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
        <tr>
            <td align="center" style="padding: 10px 0 0;">
                <table width="600" border="0" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px;">
                    <tr>
                        <td style="background:#fff3cd; border:1px solid #ffe69c; border-radius:4px; padding:10px 16px; font-size:12px; color:#664d03;">
                            Preview only: this shows your Body content in a generic wrapper. The real email is injected into your Plunk base template's own design instead of this wrapper.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>`
            : "";

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(resolvedSubject || "Preview")}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f6; font-family: Arial, sans-serif;">
    ${buildPreheaderHtml(resolvedPreheader)}
    ${banner}
    <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table width="600" border="0" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px; background-color: #ffffff;">
                    <tr>
                        <td style="padding: 30px; color: #333333; font-size: 14px; line-height: 1.6;">
                            ${resolvedBody}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

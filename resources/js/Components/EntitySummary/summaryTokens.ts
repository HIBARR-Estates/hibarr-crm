/**
 * Replacement tokens in AI summaries.
 *
 * The lead summary model is never given who the lead is (see LeadSummaryRedactor on the
 * server), so it writes `{{lead_first_name}}` where it would name them, and the card
 * swaps in the real name here when it renders. Two consequences worth keeping in mind:
 *
 *  - Substitute AFTER translation. `td()` sends text to the translation service; the
 *    service already protects `{{…}}` tokens, so tokens survive it, but a name put in
 *    before `td()` would be sent to it. Every caller does `personalize(td(text))`.
 *  - The stored summary holds tokens, never the name, so the name can change (or the
 *    lead be renamed) without regenerating.
 *
 * The token list must match the prompt and `LeadSummaryTokens::NAMES` on the server;
 * `LeadSummaryTokensTest` reads `SUMMARY_TOKEN_NAMES` below and fails if they drift.
 */
export const SUMMARY_TOKEN_NAMES = [
    "lead_first_name",
    "lead_full_name",
] as const;

export type SummaryTokenName = (typeof SUMMARY_TOKEN_NAMES)[number];

export type SummaryTokenValues = Partial<Record<SummaryTokenName, string>>;

/** Written where the lead's name is needed but not known. */
const NAMELESS_FALLBACK = "the lead";

const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_.-]*)\s*\}\}/g;

/**
 * Names are user-entered. The summary text is parsed for `**…**` / `==…==` highlights
 * and `{{…}}` tokens after substitution, so strip those sequences from a name; a
 * name must never be able to add a highlight or smuggle in a token.
 */
const clean = (value: string): string =>
    value
        .replace(/\*\*|==|\{\{|\}\}/g, "")
        .replace(/\s+/g, " ")
        .trim();

/** Token values for a lead, from the name as it is on the lead record. */
export function buildLeadTokenValues(
    fullName: string | null | undefined,
): SummaryTokenValues {
    const full = clean(fullName ?? "");

    if (!full) {
        return {};
    }

    return {
        lead_first_name: full.split(" ")[0],
        lead_full_name: full,
    };
}

function resolve(name: string, values: SummaryTokenValues): string | undefined {
    switch (name) {
        case "lead_first_name":
            return values.lead_first_name ?? values.lead_full_name;
        case "lead_full_name":
            return values.lead_full_name ?? values.lead_first_name;
        default:
            return undefined;
    }
}

/** True when what precedes `offset` ends a sentence (or there is nothing before it). */
function startsSentence(text: string, offset: number): boolean {
    const before = text.slice(0, offset).replace(/[\s*=("'“‘[]+$/, "");

    return before === "" || /[.!?:]$/.test(before);
}

/**
 * Fill tokens in with the lead's details. Never leaves a raw `{{…}}` on screen:
 *  - a known token with no value becomes "the lead" ("The lead" at a sentence start),
 *    so the sentence still reads;
 *  - an unknown lead token does the same; any other unknown token is dropped.
 */
export function personalizeSummaryText(
    text: string,
    values: SummaryTokenValues = {},
): string {
    if (!text || !text.includes("{{")) {
        return text;
    }

    let dropped = false;

    const result = text.replace(
        TOKEN_PATTERN,
        (_match, rawName: string, offset: number) => {
            const name = rawName.toLowerCase();
            const value = resolve(name, values);

            if (value) {
                return value;
            }

            if (!name.startsWith("lead_")) {
                dropped = true;
                return "";
            }

            return startsSentence(text, offset)
                ? NAMELESS_FALLBACK.charAt(0).toUpperCase() +
                      NAMELESS_FALLBACK.slice(1)
                : NAMELESS_FALLBACK;
        },
    );

    // Dropping a token can leave a doubled space or a space before punctuation.
    return dropped
        ? result
              .replace(/ {2,}/g, " ")
              .replace(/ +([,.;:!?])/g, "$1")
              .trim()
        : result;
}

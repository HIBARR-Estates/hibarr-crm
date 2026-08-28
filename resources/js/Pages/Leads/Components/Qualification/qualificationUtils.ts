import { Lead } from "@/Types/api/leads";
import {
    DEFAULT_OUTCOME_LABELS,
    OUTCOME_PRIORITY,
    QUALIFICATION_TOKENS,
    QualificationActionRef,
    QualificationOutcome,
    QualificationToken,
    ScriptOutcomeOption,
    Segment,
    SegmentAnswerState,
    SegmentOption,
    TemplateTree,
} from "@/Types/qualification";
import { AuthType } from "@/Types";

export const sortSegments = (segments: Segment[]): Segment[] =>
    [...segments].sort((a, b) => a.sortOrder - b.sortOrder);

export const findEntrySegment = (
    tree: TemplateTree,
): Segment | undefined => {
    if (tree.entryQuestionKey) {
        return tree.segments.find((s) => s.key === tree.entryQuestionKey);
    }
    return (
        tree.segments.find((s) => s.isEntryQuestion) ??
        tree.segments.find(
            (s) => s.type === "question" && s.category === "main",
        ) ??
        tree.segments.find(
            (s) => s.type === "question" && !s.parentOptionId,
        )
    );
};

const splitLeadName = (name?: string | null): { firstName: string; lastName: string } => {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
};

const leadSalutation = (lead: Lead): string =>
    String(lead.salutation_value ?? lead.salutation ?? "").trim();

/** OL mustache tokens → replacement values (empty string means omit from script). */
const OL_TOKEN_REPLACEMENTS = (
    lead: Lead,
    auth?: AuthType,
): Array<[string, string]> => {
    const { firstName, lastName } = splitLeadName(lead.client_name);

    return [
        ["{{lead.salutation}}", leadSalutation(lead)],
        ["{{lead.firstName}}", firstName],
        ["{{lead.lastName}}", lastName],
        ["{{lead.name}}", (lead.client_name ?? "").trim()],
        ["{{lead.email}}", (lead.client_email ?? "").trim()],
        ["{{lead.phone}}", (lead.mobile ?? lead.cell ?? "").trim()],
        ["{{lead.company}}", (lead.company_name ?? "").trim()],
        ["{{agent.name}}", (auth?.user?.name ?? "").trim()],
    ];
};

/**
 * Replace CRM + OL tokens. Missing / empty values are omitted (not left as
 * placeholders). Remaining unknown `{{...}}` tokens are stripped.
 */
export const resolveTokens = (
    text: string,
    tokenMap: Record<QualificationToken, string>,
    lead?: Lead,
    auth?: AuthType,
): string => {
    let resolved = text ?? "";

    QUALIFICATION_TOKENS.forEach((token) => {
        const value = (tokenMap[token] ?? "").trim();
        resolved = resolved.split(token).join(value);
    });

    if (lead) {
        OL_TOKEN_REPLACEMENTS(lead, auth).forEach(([token, value]) => {
            resolved = resolved.split(token).join(value);
        });
    }

    // Unresolved mustache placeholders — do not render
    resolved = resolved.replace(/\{\{[^{}]+\}\}/g, "");

    // Empty inline wrappers left after a missing token (e.g. <b></b>)
    resolved = resolved.replace(
        /<(b|strong|em|i|u|span)(\s[^>]*)?>\s*<\/\1>/gi,
        "",
    );

    // Tidy whitespace without collapsing intentional line breaks
    resolved = resolved.replace(/[^\S\n]{2,}/g, " ");
    resolved = resolved.replace(/ +([.,;:!?])/g, "$1");
    resolved = resolved.replace(/([(\[]) +/g, "$1");
    resolved = resolved.replace(/\n{3,}/g, "\n\n");
    resolved = resolved.replace(/^[^\S\n]+|[^\S\n]+$/gm, "");

    return resolved;
};

export interface ProtectedScript {
    text: string;
    /**
     * Splices the original tags/tokens back into a translated string.
     * Returns null if the round trip lost or duplicated a placeholder —
     * the caller should fall back to the untranslated text rather than
     * render corrupted markup.
     */
    restore: (translated: string) => string | null;
}

const HTML_TAG_RE = /<\/?[a-zA-Z][^<>]*>/g;
/** OL mustache tokens, e.g. `{{lead.firstName}}` / `{{agent.name}}`. */
const OL_TOKEN_RE = /\{\{[a-zA-Z]+\.[a-zA-Z]+\}\}/g;
/** CRM tokens from QUALIFICATION_TOKENS, e.g. `{leadName}`. */
const CRM_TOKEN_RE = new RegExp(
    QUALIFICATION_TOKENS.map((token) => token.replace(/[{}]/g, "\\$&")).join(
        "|",
    ),
    "g",
);
const PLACEHOLDER_RE = /⟦(\d+)⟧/g;

/**
 * Swap HTML tags and CRM/OL tokens for inert numbered placeholders before a
 * script label is sent to the translation API. Sending raw `<strong>` /
 * `{{lead.firstName}}` markup through translation is unreliable — models
 * mistranslate or drop it. Placeholders travel through untouched, then
 * `restore()` puts the originals back in the translated string.
 */
export const protectScriptForTranslation = (text: string): ProtectedScript => {
    const originals: string[] = [];
    const protect = (value: string): string =>
        `⟦${originals.push(value) - 1}⟧`;

    const protectedText = (text ?? "")
        .replace(HTML_TAG_RE, protect)
        .replace(OL_TOKEN_RE, protect)
        .replace(CRM_TOKEN_RE, protect);

    return {
        text: protectedText,
        restore: (translated: string): string | null => {
            const seen = new Set<number>();
            let broken = false;

            const restored = (translated ?? "").replace(
                PLACEHOLDER_RE,
                (match, indexStr) => {
                    const index = Number(indexStr);
                    const original = originals[index];
                    if (original === undefined || seen.has(index)) {
                        broken = true;
                        return match;
                    }
                    seen.add(index);
                    return original;
                },
            );

            if (broken || seen.size !== originals.length) {
                return null;
            }

            return restored;
        },
    };
};

/** Plain-text preview for nav / answers rails (strips OL rich text). */
export const stripHtmlTags = (html: string): string =>
    (html ?? "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/p>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();

/** True when the text already has block-level HTML (paragraphs, headings, lists, quotes). */
const HAS_BLOCK_HTML = /<(p|div|h[1-6]|ul|ol|li|blockquote)[\s>]/i;

/**
 * Prepare resolved script text for HTML rendering. Plain text (no block
 * markup) gets its line breaks turned into `<br />` so it still reads in
 * paragraphs; already-rich HTML is left alone — its own block tags (and the
 * CSS spacing on them) carry the layout, and converting stray whitespace
 * between tags to `<br />` would double up the gap those tags already add.
 */
export const toQualificationHtml = (text: string): string => {
    const normalized = (text ?? "").replace(/\r\n/g, "\n");
    return HAS_BLOCK_HTML.test(normalized)
        ? normalized
        : normalized.replace(/\n/g, "<br />");
};

export const matchOptionByStoredValue = (
    segment: Segment | undefined,
    storedValue: string,
): SegmentOption | undefined => {
    if (!segment?.options) {
        return undefined;
    }

    return (
        segment.options.find(
            (option) => option.id === storedValue || option.key === storedValue,
        ) ?? undefined
    );
};

export const mapStoredValuesToOptionIds = (
    segment: Segment | undefined,
    storedValues: string[],
): string[] => {
    if (!segment?.options?.length) {
        return storedValues;
    }

    return storedValues.map((storedValue) => {
        const option = matchOptionByStoredValue(segment, storedValue);
        return option?.id ?? storedValue;
    });
};

export const mapOptionIdsToStoredValues = (
    segment: Segment | undefined,
    optionIds: string[],
): string[] => {
    if (!segment?.options?.length) {
        return optionIds;
    }

    return optionIds.map((optionId) => {
        const option = segment.options?.find((item) => item.id === optionId);
        return option?.key ?? optionId;
    });
};

export const collectSelectedOptionIds = (
    tree: TemplateTree,
    answers: Record<string, SegmentAnswerState>,
): Set<string> => {
    const ids = new Set<string>();

    tree.segments.forEach((segment) => {
        const answer = answers[segment.key];
        if (!answer?.answer_values.length) {
            return;
        }

        mapStoredValuesToOptionIds(segment, answer.answer_values).forEach(
            (value) => ids.add(value),
        );
    });

    return ids;
};

export const isSegmentVisible = (
    segment: Segment,
    selectedOptionIds: Set<string>,
    entryAnswered: boolean,
): boolean => {
    if (segment.isEntryQuestion) {
        return true;
    }

    if (segment.parentOptionId) {
        if (!entryAnswered) {
            return false;
        }
        return selectedOptionIds.has(segment.parentOptionId);
    }

    if (segment.type === "question" && !segment.isEntryQuestion) {
        return entryAnswered;
    }

    return entryAnswered || segment.type === "say" || segment.type === "instruction";
};

export const computeVisibleSegments = (
    tree: TemplateTree,
    answers: Record<string, SegmentAnswerState>,
): Segment[] => {
    const entry = findEntrySegment(tree);
    const entryAnswered = entry
        ? Boolean(answers[entry.key]?.answer_values.length)
        : true;
    const selectedOptionIds = collectSelectedOptionIds(tree, answers);

    return sortSegments(tree.segments).filter((segment) =>
        isSegmentVisible(segment, selectedOptionIds, entryAnswered),
    );
};

/** Visible say/instruction/question segments — outcomes are handled in a separate phase. */
export const computeWalkSegments = (
    tree: TemplateTree,
    answers: Record<string, SegmentAnswerState>,
): Segment[] =>
    computeVisibleSegments(tree, answers).filter(
        (segment) => segment.type !== "outcome",
    );

export const hasAnswerContent = (answer?: SegmentAnswerState): boolean => {
    if (!answer) return false;
    if (answer.answer_text?.trim()) return true;
    return answer.answer_values.length > 0;
};

export const findOutcomeSegment = (
    tree: TemplateTree,
    outcome: QualificationOutcome,
): Segment | undefined =>
    sortSegments(tree.segments).find(
        (segment) =>
            segment.type === "outcome" &&
            segment.outcomeMetadata?.type === outcome,
    );

export const FALLBACK_OUTCOME_BODIES: Record<QualificationOutcome, string> = {
    bookMeeting:
        "Thank you. Based on what you have shared, a conversation with the specialist sounds like a good next step. I would be happy to arrange an appointment for you.",
    inviteWebinar:
        "Thank you for your openness. A personal conversation may still be a little early. I would be happy to invite you to our next live webinar so you can get a clearer overview at your own pace.",
    callback:
        "Understood. I will arrange a callback so we can continue when the timing works better for you.",
    noFit:
        "Thank you for your time. Based on what you have shared, this does not look like the right fit right now. We will leave it here.",
};

export const FALLBACK_OUTCOME_CTA: Record<QualificationOutcome, string> = {
    bookMeeting: "Book appointment",
    inviteWebinar: "Invite to webinar",
    callback: "Schedule callback",
    noFit: "Mark as not a fit",
};

/** Always the four CRM outcomes, preferring tree labels when present. */
export const getAllOutcomeChoices = (
    tree: TemplateTree,
): ScriptOutcomeOption[] => {
    const fromTree = getScriptOutcomes(tree);
    const byKey = new Map(fromTree.map((item) => [item.key, item]));

    return OUTCOME_PRIORITY.map((key) => {
        const existing = byKey.get(key);
        return {
            key,
            label: existing?.label || DEFAULT_OUTCOME_LABELS[key],
            webinarId: existing?.webinarId,
            calendlyUrl: existing?.calendlyUrl,
        };
    });
};

const LEGACY_ACTIONS_FOR_OUTCOME: Record<
    QualificationOutcome,
    QualificationActionRef[]
> = {
    bookMeeting: [{ type: "book_consultation" }],
    inviteWebinar: [{ type: "invite_webinar" }],
    callback: [{ type: "schedule_callback" }],
    noFit: [{ type: "mark_no_fit" }],
};

export const buildTokenMap = (
    lead: Lead,
    auth?: AuthType,
): Record<QualificationToken, string> => ({
    "{leadName}": lead.client_name ?? "",
    "{leadEmail}": lead.client_email ?? "",
    "{leadPhone}": lead.mobile ?? lead.cell ?? "",
    "{companyName}": lead.company_name ?? "",
    "{agentName}": auth?.user?.name ?? "",
});

export const splitTokenParts = (
    text: string,
): Array<{ type: "text" | "token"; value: string; token?: QualificationToken }> => {
    const parts: Array<{
        type: "text" | "token";
        value: string;
        token?: QualificationToken;
    }> = [];
    let remaining = text;

    while (remaining.length > 0) {
        let earliestIndex = -1;
        let matchedToken: QualificationToken | undefined;

        QUALIFICATION_TOKENS.forEach((token) => {
            const index = remaining.indexOf(token);
            if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
                earliestIndex = index;
                matchedToken = token;
            }
        });

        if (earliestIndex === -1 || !matchedToken) {
            parts.push({ type: "text", value: remaining });
            break;
        }

        if (earliestIndex > 0) {
            parts.push({
                type: "text",
                value: remaining.slice(0, earliestIndex),
            });
        }

        parts.push({
            type: "token",
            value: matchedToken,
            token: matchedToken,
        });

        remaining = remaining.slice(earliestIndex + matchedToken.length);
    }

    return parts;
};

export const answersFromQualification = (
    answers: Array<{
        segment_key: string;
        answer_values: string[];
        answer_text?: string | null;
    }> = [],
    tree?: TemplateTree,
): Record<string, SegmentAnswerState> => {
    const map: Record<string, SegmentAnswerState> = {};
    answers.forEach((answer) => {
        const segment = tree?.segments.find(
            (item) => item.key === answer.segment_key,
        );
        const storedValues = answer.answer_values ?? [];

        map[answer.segment_key] = {
            answer_values: tree
                ? mapStoredValuesToOptionIds(segment, storedValues)
                : storedValues,
            answer_text: answer.answer_text ?? null,
        };
    });
    return map;
};

export const getBranchOptionKeys = (
    tree: TemplateTree,
    entrySegment: Segment | undefined,
    previousEntryValues: string[],
): string[] => {
    if (!entrySegment?.options) {
        return [];
    }
    return entrySegment.options
        .filter(
            (option) =>
                previousEntryValues.includes(option.id) ||
                previousEntryValues.includes(option.key),
        )
        .map((option) => option.key);
};

export const getBranchSegmentKeysToClear = (
    tree: TemplateTree,
    entrySegment: Segment | undefined,
): string[] => {
    if (!entrySegment) {
        return [];
    }

    return tree.segments
        .filter(
            (segment) =>
                segment.key !== entrySegment.key &&
                Boolean(segment.parentOptionId),
        )
        .map((segment) => segment.key);
};

export const formatAnswerDisplay = (
    segment: Segment | undefined,
    answer?: SegmentAnswerState,
): string => {
    if (!answer) {
        return "";
    }

    if (segment?.answerType === "text") {
        return answer.answer_text?.trim() ?? "";
    }

    if (segment?.answerType === "boolean") {
        const raw = answer.answer_values[0];
        if (raw === "true" || raw === "yes") return "Yes";
        if (raw === "false" || raw === "no") return "No";
        return raw ?? "";
    }

    return (segment?.options ?? [])
        .filter(
            (option) =>
                answer.answer_values.includes(option.id) ||
                answer.answer_values.includes(option.key),
        )
        .map((option) => option.label)
        .join(", ");
};

export const validateSegmentAnswer = (
    segment: Segment,
    answer?: SegmentAnswerState,
): string | null => {
    if (segment.type !== "question" || !segment.required) {
        return null;
    }

    if (!answer) {
        return "required";
    }

    if (segment.answerType === "text") {
        return answer.answer_text?.trim() ? null : "required";
    }

    if (segment.answerType === "boolean") {
        return answer.answer_values.length ? null : "required";
    }

    return answer.answer_values.length ? null : "required";
};

/**
 * Distinct outcome keys from the published script tree (ignores parentOptionId
 * and options-under-outcome). Falls back to all known outcomes if the tree
 * has none configured.
 */
export const getScriptOutcomes = (tree: TemplateTree): ScriptOutcomeOption[] => {
    const byKey = new Map<QualificationOutcome, ScriptOutcomeOption>();

    sortSegments(tree.segments).forEach((segment) => {
        if (segment.type !== "outcome") {
            return;
        }
        const key = segment.outcomeMetadata?.type;
        if (!key) {
            return;
        }

        const existing = byKey.get(key);
        if (existing) {
            if (!existing.webinarId && segment.outcomeMetadata?.webinarId) {
                existing.webinarId = segment.outcomeMetadata.webinarId;
            }
            if (!existing.calendlyUrl && segment.outcomeMetadata?.calendlyUrl) {
                existing.calendlyUrl = segment.outcomeMetadata.calendlyUrl;
            }
            if (
                (!existing.label || existing.label === DEFAULT_OUTCOME_LABELS[key]) &&
                (segment.outcomeMetadata?.label || segment.label)
            ) {
                existing.label =
                    segment.outcomeMetadata?.label ||
                    segment.label ||
                    existing.label;
            }
            return;
        }

        byKey.set(key, {
            key,
            // Prefer the chooser-friendly DEFAULT over CTA labels stored on
            // outcomeMetadata.label (OL maps ctaLabel there).
            label: DEFAULT_OUTCOME_LABELS[key],
            webinarId: segment.outcomeMetadata?.webinarId,
            calendlyUrl: segment.outcomeMetadata?.calendlyUrl,
        });
    });

    if (byKey.size === 0) {
        return OUTCOME_PRIORITY.map((key) => ({
            key,
            label: DEFAULT_OUTCOME_LABELS[key],
        }));
    }

    return OUTCOME_PRIORITY.filter((key) => byKey.has(key)).map(
        (key) => byKey.get(key)!,
    );
};

/**
 * Deduped action refs for the selected outcome keys (from outcome segments
 * in the published tree). Falls back to legacy action types when the tree
 * has no matching outcome segment (e.g. callback / noFit).
 */
export const getActionsForSelectedOutcomes = (
    tree: TemplateTree,
    selectedOutcomeKeys: QualificationOutcome[],
): QualificationActionRef[] => {
    const selected = new Set(selectedOutcomeKeys);
    const byType = new Map<string, QualificationActionRef>();

    sortSegments(tree.segments).forEach((segment) => {
        if (segment.type !== "outcome") return;
        const outcomeKey = segment.outcomeMetadata?.type;
        if (!outcomeKey || !selected.has(outcomeKey)) return;

        (segment.actions ?? []).forEach((action) => {
            const existing = byType.get(action.type);
            if (!existing) {
                byType.set(action.type, {
                    type: action.type,
                    config: action.config ? { ...action.config } : undefined,
                });
                return;
            }
            if (!action.config) return;
            const merged = { ...(existing.config ?? {}) };
            Object.entries(action.config).forEach(([key, value]) => {
                if (value && !merged[key]) {
                    merged[key] = value;
                }
            });
            existing.config = Object.keys(merged).length ? merged : undefined;
        });
    });

    selectedOutcomeKeys.forEach((outcomeKey) => {
        const matchingSegments = sortSegments(tree.segments).filter(
            (segment) =>
                segment.type === "outcome" &&
                segment.outcomeMetadata?.type === outcomeKey,
        );
        const hasConfiguredActions = matchingSegments.some(
            (segment) => segment.actions?.length,
        );
        if (hasConfiguredActions) return;
        LEGACY_ACTIONS_FOR_OUTCOME[outcomeKey].forEach((action) => {
            if (!byType.has(action.type)) {
                byType.set(action.type, { ...action });
            }
        });
    });

    return Array.from(byType.values());
};


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

const OL_TOKEN_REPLACEMENTS = (
    lead: Lead,
    auth?: AuthType,
): Array<[string, string]> => {
    const { firstName, lastName } = splitLeadName(lead.client_name);

    return [
        ["{{lead.firstName}}", firstName],
        ["{{lead.lastName}}", lastName],
        ["{{lead.name}}", lead.client_name ?? ""],
        ["{{lead.email}}", lead.client_email ?? ""],
        ["{{lead.phone}}", lead.mobile ?? lead.cell ?? ""],
        ["{{lead.company}}", lead.company_name ?? ""],
        ["{{agent.name}}", auth?.user?.name ?? ""],
    ];
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

export const resolveTokens = (
    text: string,
    tokenMap: Record<QualificationToken, string>,
    lead?: Lead,
    auth?: AuthType,
): string => {
    let resolved = text;
    QUALIFICATION_TOKENS.forEach((token) => {
        resolved = resolved.split(token).join(tokenMap[token] || "");
    });

    if (lead) {
        OL_TOKEN_REPLACEMENTS(lead, auth).forEach(([token, value]) => {
            resolved = resolved.split(token).join(value);
        });
    }

    return resolved;
};

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
        return answer.answer_values[0] === "true" ? "Yes" : "No";
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
            label:
                segment.outcomeMetadata?.label ||
                segment.label ||
                DEFAULT_OUTCOME_LABELS[key],
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
 * in the published tree). Merges config preferring first non-empty values.
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

    return Array.from(byType.values());
};


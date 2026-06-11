import { Lead } from "@/Types/api/leads";
import {
    QUALIFICATION_TOKENS,
    QualificationToken,
    Segment,
    SegmentAnswerState,
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

export const collectSelectedOptionIds = (
    answers: Record<string, SegmentAnswerState>,
): Set<string> => {
    const ids = new Set<string>();
    Object.values(answers).forEach((answer) => {
        answer.answer_values.forEach((value) => ids.add(value));
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
    const selectedOptionIds = collectSelectedOptionIds(answers);

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
): string => {
    let resolved = text;
    QUALIFICATION_TOKENS.forEach((token) => {
        resolved = resolved.split(token).join(tokenMap[token] || "");
    });
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
): Record<string, SegmentAnswerState> => {
    const map: Record<string, SegmentAnswerState> = {};
    answers.forEach((answer) => {
        map[answer.segment_key] = {
            answer_values: answer.answer_values ?? [],
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
        .filter((option) => previousEntryValues.includes(option.id))
        .map((option) => option.key);
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

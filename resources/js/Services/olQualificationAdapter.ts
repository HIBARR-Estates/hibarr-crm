/**
 * Normalizes OL v1 qualification API responses into CRM-internal types.
 */

import type {
    AnswerType,
    PublishedTemplate,
    QualificationOutcome,
    Segment,
    SegmentOption,
    TemplateTree,
} from "@/Types/qualification";

const OUTCOME_KEY_MAP: Record<string, QualificationOutcome> = {
    book_meeting: "bookMeeting",
    bookMeeting: "bookMeeting",
    invite_webinar: "inviteWebinar",
    inviteWebinar: "inviteWebinar",
    callback: "callback",
    no_fit: "noFit",
    noFit: "noFit",
};

const ANSWER_TYPE_MAP: Record<string, AnswerType> = {
    single_select: "singleSelect",
    singleSelect: "singleSelect",
    multi_select: "multiSelect",
    multiSelect: "multiSelect",
    text: "text",
    boolean: "boolean",
};

export interface OlTemplateListItem {
    id: number | string;
    name: string;
    description?: string | null;
    version: number;
    status?: string;
}

export interface OlTemplateListResponse {
    success: boolean;
    data?: {
        result?: OlTemplateListItem[];
    };
}

export interface OlSegmentOption {
    id: number | string;
    value: string;
    label: string;
    order?: number;
}

export interface OlSegment {
    key: string;
    type: Segment["type"];
    body?: string | null;
    prompt?: string | null;
    order: number;
    answerType?: string | null;
    required?: boolean;
    parentOptionId?: number | string | null;
    outcomeKey?: string | null;
    ctaLabel?: string | null;
    webinarId?: string | number | null;
    calendlyUrl?: string | null;
    options?: OlSegmentOption[];
    isEntryQuestion?: boolean;
}

export interface OlTemplateTreeData {
    templateId: number | string;
    templateVersion: number;
    name?: string;
    segments: OlSegment[];
    entryQuestionKey?: string;
}

export interface OlTemplateTreeResponse {
    success: boolean;
    data: OlTemplateTreeData;
}

const toStringId = (value: number | string | null | undefined): string =>
    value == null ? "" : String(value);

const normalizeAnswerType = (
    answerType?: string | null,
): AnswerType | undefined => {
    if (!answerType) {
        return undefined;
    }

    return ANSWER_TYPE_MAP[answerType];
};

const normalizeOutcomeType = (
    outcomeKey?: string | null,
): QualificationOutcome | undefined => {
    if (!outcomeKey) {
        return undefined;
    }

    return OUTCOME_KEY_MAP[outcomeKey];
};

const normalizeOption = (option: OlSegmentOption): SegmentOption => ({
    id: toStringId(option.id),
    key: option.value,
    label: option.label,
    sortOrder: option.order,
});

const segmentLabel = (segment: OlSegment): string =>
    (segment.prompt || segment.body || "").trim();

export const normalizeOlSegment = (segment: OlSegment): Segment => {
    const outcomeType = normalizeOutcomeType(segment.outcomeKey);

    return {
        key: segment.key,
        type: segment.type,
        label: segmentLabel(segment),
        sortOrder: segment.order,
        parentOptionId:
            segment.parentOptionId != null
                ? toStringId(segment.parentOptionId)
                : null,
        answerType: normalizeAnswerType(segment.answerType),
        required: segment.required ?? false,
        options: (segment.options ?? []).map(normalizeOption),
        outcomeMetadata: outcomeType
            ? {
                  type: outcomeType,
                  label: segment.ctaLabel ?? undefined,
                  webinarId:
                      segment.webinarId != null
                          ? toStringId(segment.webinarId)
                          : undefined,
                  calendlyUrl: segment.calendlyUrl ?? undefined,
              }
            : undefined,
        isEntryQuestion: segment.isEntryQuestion ?? false,
    };
};

const markEntryQuestion = (segments: Segment[]): Segment[] => {
    const entryIndex = segments.findIndex(
        (segment) =>
            segment.isEntryQuestion ||
            (segment.type === "question" && !segment.parentOptionId),
    );

    if (entryIndex === -1) {
        return segments;
    }

    return segments.map((segment, index) =>
        index === entryIndex
            ? { ...segment, isEntryQuestion: true }
            : segment,
    );
};

export const normalizeOlTemplateTree = (
    data: OlTemplateTreeData,
    templateName?: string,
): TemplateTree => {
    const segments = markEntryQuestion(
        (data.segments ?? []).map(normalizeOlSegment),
    );
    const entrySegment = segments.find((segment) => segment.isEntryQuestion);

    return {
        templateId: toStringId(data.templateId),
        templateVersion: data.templateVersion,
        name: data.name ?? templateName ?? toStringId(data.templateId),
        segments,
        entryQuestionKey: data.entryQuestionKey ?? entrySegment?.key,
    };
};

export const normalizeOlTemplateList = (
    response: OlTemplateListResponse,
): PublishedTemplate[] => {
    const items = response.data?.result ?? [];

    return items.map((item) => ({
        id: toStringId(item.id),
        name: item.name,
        version: item.version,
        description: item.description ?? undefined,
    }));
};

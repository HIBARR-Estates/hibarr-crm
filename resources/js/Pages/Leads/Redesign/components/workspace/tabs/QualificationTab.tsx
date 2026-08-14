import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    LeadQualification,
    QualificationOutcome,
    TemplateTree,
} from "@/Types/qualification";
import {
    COMPLETED_OUTCOME_LABELS,
    DEFAULT_OUTCOME_LABELS,
} from "@/Types/qualification";
import { getQualificationTemplateService } from "@/Services/QualificationTemplateService";
import {
    answersFromQualification,
    computeWalkSegments,
    findEntrySegment,
    formatAnswerDisplay,
    hasAnswerContent,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    Badge,
    Button,
    ConfirmDialog,
    EmptyState,
    Icon,
} from "@/Components/Redesign";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import {
    useScriptMapping,
    type FieldMappingRow,
} from "@/Features/Leads/QualificationMapping/mappingApi";

interface QualificationTabProps {
    current: LeadQualification | null;
    history: LeadQualification[];
    onStartQualify?: () => void;
    onResumeQualify?: (qualification: LeadQualification) => void;
    onDeleteQualify?: (qualification: LeadQualification) => Promise<boolean> | boolean;
    canStart?: boolean;
}

type BarTone = "positive" | "attention" | "neutral" | "negative" | "muted";

const OUTCOME_TONE: Record<QualificationOutcome, BarTone> = {
    bookMeeting: "positive",
    callback: "attention",
    inviteWebinar: "neutral",
    noFit: "negative",
};

const OUTCOME_ICON: Record<QualificationOutcome, string> = {
    bookMeeting: "check",
    callback: "clock",
    inviteWebinar: "users",
    noFit: "x",
};

const BAR_STYLE: Record<
    BarTone,
    { bg: string; border: string; icon: string; title: string; sub: string }
> = {
    positive: {
        bg: T.NAVY,
        border: T.NAVY,
        icon: "#ffffff",
        title: "#ffffff",
        sub: "rgba(255,255,255,.66)",
    },
    attention: {
        bg: T.AMBER_BANNER,
        border: T.AMBER_MID,
        icon: T.AMBER,
        title: T.AMBER,
        sub: T.AMBER_TEXT,
    },
    neutral: {
        bg: T.BLUE_LIGHT,
        border: T.BLUE_MID,
        icon: T.BLUE_DARK,
        title: T.BLUE_DARK,
        sub: T.BLUE_DARK,
    },
    negative: {
        bg: T.RED_SOFT,
        border: T.RED_MID,
        icon: T.RED,
        title: T.RED,
        sub: T.TEXT_MUTED,
    },
    muted: {
        bg: T.SURFACE_2,
        border: T.BORDER,
        icon: T.TEXT_MUTED,
        title: T.TEXT,
        sub: T.TEXT_MUTED,
    },
};

const PILL_TONE: Record<BarTone, "navy" | "amber" | "blue" | "red" | "gray"> = {
    positive: "navy",
    attention: "amber",
    neutral: "blue",
    negative: "red",
    muted: "gray",
};

/** Newest first — the rail's ordering and "Latest" marker both rely on it. */
function collectCalls(
    current: LeadQualification | null,
    history: LeadQualification[],
): LeadQualification[] {
    const list = [...history];
    if (current && !list.some((item) => item.id === current.id)) {
        list.unshift(current);
    }
    return list.sort(
        (a, b) =>
            new Date(b.completed_at ?? b.created_at).getTime() -
            new Date(a.completed_at ?? a.created_at).getTime(),
    );
}

function outcomeKeys(call: LeadQualification): QualificationOutcome[] {
    const keys = call.outcomes?.length
        ? call.outcomes
        : call.outcome
          ? [call.outcome]
          : [];
    return keys.filter(Boolean) as QualificationOutcome[];
}

function callTone(call: LeadQualification): BarTone {
    if (call.status !== "completed") return "muted";
    const [first] = outcomeKeys(call);
    return first ? (OUTCOME_TONE[first] ?? "muted") : "muted";
}

export default function QualificationTab({
    current,
    history,
    onStartQualify,
    onResumeQualify,
    onDeleteQualify,
    canStart,
}: QualificationTabProps) {
    const { td } = useTd();
    const calls = useMemo(
        () => collectCalls(current, history),
        [current, history],
    );

    const [selectedId, setSelectedId] = useState<number | null>(
        calls[0]?.id ?? null,
    );

    useEffect(() => {
        setSelectedId((prev) =>
            prev && calls.some((call) => call.id === prev)
                ? prev
                : (calls[0]?.id ?? null),
        );
    }, [calls]);

    const selected =
        calls.find((call) => call.id === selectedId) ?? calls[0] ?? null;

    // Calls grouped by the script they ran, newest group first.
    const groups = useMemo(() => {
        const map = new Map<
            string,
            { id: string; name: string; calls: LeadQualification[] }
        >();
        for (const call of calls) {
            const id = String(call.template_id || call.template_name || "unknown");
            const existing = map.get(id);
            if (existing) {
                existing.calls.push(call);
            } else {
                map.set(id, {
                    id,
                    name: call.template_name || call.template_id || "Script",
                    calls: [call],
                });
            }
        }
        return Array.from(map.values());
    }, [calls]);

    const latestId = calls[0]?.id ?? null;
    const abandonedCount = calls.filter(
        (call) => call.status === "abandoned",
    ).length;
    const hasInProgress = calls.some((call) => call.status === "inProgress");

    if (!calls.length) {
        return (
            <div className="flex flex-col items-center gap-3">
                <div className="w-full">
                    <EmptyState
                        title={td("No qualification calls yet", { source: "en" })}
                        description={td(
                            "Start a call to capture the lead's answers here.",
                            { source: "en" },
                        )}
                    />
                </div>
                {canStart && onStartQualify ? (
                    <Button
                        variant="primary"
                        icon={<Icon name="phone" size={14} />}
                        onClick={onStartQualify}
                    >
                        {td("New qualification call", { source: "en" })}
                    </Button>
                ) : null}
            </div>
        );
    }

    return (
        <div
            className="grid gap-5 items-start"
            style={{ gridTemplateColumns: "minmax(0, 296px) minmax(0, 1fr)" }}
        >
            <div
                className="flex flex-col rounded-xl overflow-hidden"
                style={{
                    background: T.SURFACE,
                    border: `1px solid ${T.BORDER}`,
                    maxHeight: 756,
                }}
            >
                <div
                    className="px-4 py-3"
                    style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className="text-[13px] font-semibold"
                            style={{ color: T.TEXT }}
                        >
                            {td("Calls", { source: "en" })}
                        </span>
                        <Badge variant="gray">{calls.length}</Badge>
                        <span className="flex-1" />
                        <span
                            className="text-[12px]"
                            style={{ color: T.TEXT_HINT }}
                        >
                            {groups.length}{" "}
                            {groups.length === 1
                                ? td("script", { source: "en" })
                                : td("scripts", { source: "en" })}
                        </span>
                    </div>
                    {/* Always present — an open call disables it rather than
                        hiding it, so the rail header never loses its action.
                        Picks the script (auto-starts when there's only one). */}
                    <div className="flex flex-col gap-2 mt-3">
                        <Button
                            size="sm"
                            variant="primary"
                            icon={<Icon name="phone" size={13} />}
                            style={{ width: "100%" }}
                            disabled={!canStart}
                            title={
                                canStart
                                    ? undefined
                                    : td(
                                          "Finish the open call before starting another.",
                                          { source: "en" },
                                      )
                            }
                            onClick={onStartQualify}
                        >
                            {td("New qualification call", { source: "en" })}
                        </Button>
                    </div>
                    {hasInProgress ? (
                        <p
                            className="mt-2 mb-0 text-[12px]"
                            style={{ color: T.TEXT_HINT }}
                        >
                            {td("Finish the open call before starting another.", {
                                source: "en",
                            })}
                        </p>
                    ) : null}
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                    {groups.map((group) => (
                        <div key={group.id}>
                            <div
                                className="flex items-baseline gap-2 px-4 py-2.5"
                                style={{
                                    background: T.SURFACE_2,
                                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                }}
                            >
                                <span
                                    className="flex-1 min-w-0 text-[12px] font-bold uppercase tracking-wider leading-snug"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {group.name}
                                </span>
                                <span
                                    className="text-[12px] shrink-0"
                                    style={{ color: T.TEXT_HINT }}
                                >
                                    {group.calls.length}
                                </span>
                            </div>
                            {group.calls.map((call) => (
                                <CallRow
                                    key={call.id}
                                    call={call}
                                    active={selected?.id === call.id}
                                    latest={call.id === latestId}
                                    onSelect={() => setSelectedId(call.id)}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {selected ? (
                <CallDetail
                    key={selected.id}
                    call={selected}
                    abandonedCount={abandonedCount}
                    onResume={
                        onResumeQualify ? () => onResumeQualify(selected) : undefined
                    }
                    onDelete={
                        onDeleteQualify ? () => onDeleteQualify(selected) : undefined
                    }
                />
            ) : null}
        </div>
    );
}

function CallRow({
    call,
    active,
    latest,
    onSelect,
}: {
    call: LeadQualification;
    active: boolean;
    latest: boolean;
    onSelect: () => void;
}) {
    const { td } = useTd();
    const tone = callTone(call);
    const keys = outcomeKeys(call);
    const label =
        call.status === "inProgress"
            ? td("In progress", { source: "en" })
            : call.status === "abandoned"
              ? td("Abandoned", { source: "en" })
              : keys.length
                ? td(
                      COMPLETED_OUTCOME_LABELS[keys[0]] ??
                          DEFAULT_OUTCOME_LABELS[keys[0]] ??
                          keys[0],
                      { source: "en" },
                  )
                : td("Completed", { source: "en" });

    return (
        <button
            type="button"
            onClick={onSelect}
            className="w-full text-left flex gap-2.5 px-4 py-3"
            style={{
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                background: active ? T.BLUE_LIGHT : "transparent",
            }}
        >
            <span
                className="rounded-sm shrink-0"
                style={{
                    width: 3,
                    background: active ? T.BLUE : "transparent",
                }}
            />
            <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                    <Badge variant={PILL_TONE[tone]}>{label}</Badge>
                    {latest ? (
                        <span
                            className="text-[12px] font-semibold"
                            style={{ color: T.TEXT_HINT }}
                        >
                            {td("Latest", { source: "en" })}
                        </span>
                    ) : null}
                </span>
                <span
                    className="block mt-1.5 text-[12px]"
                    style={{ color: T.TEXT_MUTED }}
                >
                    {formatCompanyDateTime(call.completed_at ?? call.created_at)}
                </span>
                <span
                    className="block mt-0.5 text-[12px] truncate"
                    style={{ color: T.TEXT_HINT }}
                >
                    {call.agent?.name ?? td("Unassigned", { source: "en" })} ·{" "}
                    {call.answers?.length ?? 0} {td("answers", { source: "en" })}
                </span>
            </span>
        </button>
    );
}

function CallDetail({
    call,
    abandonedCount,
    onResume,
    onDelete,
}: {
    call: LeadQualification;
    abandonedCount: number;
    onResume?: () => void;
    onDelete?: () => Promise<boolean> | boolean;
}) {
    const { td } = useTd();
    const templateService = useMemo(() => getQualificationTemplateService(), []);
    const treeCache = useRef<Map<string, TemplateTree>>(new Map());
    const [tree, setTree] = useState<TemplateTree | null>(
        () => treeCache.current.get(call.template_id) ?? null,
    );
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const mapping = useScriptMapping(call.template_id);

    useEffect(() => {
        const cached = treeCache.current.get(call.template_id);
        if (cached) {
            setTree(cached);
            return;
        }

        let cancelled = false;
        void templateService
            .getTemplateTree(call.template_id, call.template_name ?? undefined)
            .then((response) => {
                if (cancelled) return;
                treeCache.current.set(call.template_id, response.data);
                setTree(response.data);
            })
            .catch(() => {
                // Raw answers still render below without the tree.
            });

        return () => {
            cancelled = true;
        };
    }, [call.template_id, call.template_name, templateService]);

    const answerMap = useMemo(
        () => answersFromQualification(call.answers ?? [], tree ?? undefined),
        [call.answers, tree],
    );

    const mappingBySegment = useMemo(() => {
        const map = new Map<string, FieldMappingRow>();
        for (const row of mapping?.mappings ?? []) {
            if (row.lead_field) map.set(row.segment_key, row);
        }
        return map;
    }, [mapping]);

    const fieldLabelFor = useCallback(
        (segmentKey: string): string | null => {
            // auto_write off means nothing this script captures reaches the lead.
            if (mapping && !mapping.auto_write) return null;
            const row = mappingBySegment.get(segmentKey);
            if (!row?.lead_field) return null;
            return row.lead_field_label ?? row.lead_field;
        },
        [mapping, mappingBySegment],
    );

    const questionSegments = useMemo(
        () =>
            tree
                ? computeWalkSegments(tree, answerMap).filter(
                      (segment) => segment.type === "question",
                  )
                : [],
        [answerMap, tree],
    );

    const entrySegment = useMemo(
        () => (tree ? findEntrySegment(tree) : undefined),
        [tree],
    );

    const rows = useMemo(
        () =>
            questionSegments
                .filter((segment) => segment.key !== entrySegment?.key)
                .map((segment) => {
                    const answer = answerMap[segment.key];
                    const answered = hasAnswerContent(answer);
                    const display = stripHtmlTags(
                        formatAnswerDisplay(segment, answer),
                    );
                    const note = answer?.answer_text?.trim() ?? "";
                    return {
                        key: segment.key,
                        question: stripHtmlTags(segment.label) || segment.key,
                        answer: answered ? display || note : "",
                        note:
                            answered &&
                            segment.answerType !== "text" &&
                            note &&
                            note !== display
                                ? note
                                : "",
                        field: fieldLabelFor(segment.key),
                    };
                })
                .filter((row) => row.answer !== ""),
        [answerMap, entrySegment, fieldLabelFor, questionSegments],
    );

    const mainAnswer = entrySegment
        ? stripHtmlTags(
              formatAnswerDisplay(entrySegment, answerMap[entrySegment.key]),
          )
        : "";
    const mainNote = entrySegment
        ? (answerMap[entrySegment.key]?.answer_text?.trim() ?? "")
        : "";

    const handleDeleteConfirm = async () => {
        if (!onDelete || deleting) return;
        setDeleting(true);
        try {
            const ok = await onDelete();
            if (ok) setConfirmDeleteOpen(false);
        } finally {
            setDeleting(false);
        }
    };

    const when = formatCompanyDateTime(call.completed_at ?? call.created_at);

    return (
        <div className="flex flex-col gap-3.5 min-w-0">
            <StatusBar
                call={call}
                when={when}
                onResume={onResume}
                onDelete={onDelete ? () => setConfirmDeleteOpen(true) : undefined}
            />

            <div
                className="rounded-xl px-5 py-4"
                style={{
                    background: T.SURFACE,
                    border: `1px solid ${T.BORDER}`,
                }}
            >
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                        className="text-[12px] font-bold uppercase tracking-wider"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {td("Main question", { source: "en" })}
                    </span>
                    <span
                        className="text-[12px]"
                        style={{ color: T.TEXT_HINT }}
                    >
                        {call.template_name ?? call.template_id} · {when}
                    </span>
                </div>
                <p
                    className="mt-3 mb-0 text-[13px] leading-relaxed"
                    style={{ color: T.TEXT_MUTED }}
                >
                    {entrySegment
                        ? stripHtmlTags(entrySegment.label)
                        : td("Main question not available for this script.", {
                              source: "en",
                          })}
                </p>
                <p
                    className="mt-1.5 mb-0 text-[19px] font-bold leading-tight"
                    style={{ color: T.NAVY }}
                >
                    {mainAnswer || mainNote || "—"}
                </p>
                {mainNote && mainNote !== mainAnswer ? (
                    <p
                        className="mt-2.5 mb-0 pl-3 text-[12px] leading-relaxed"
                        style={{
                            borderLeft: `2px solid ${T.NAVY_MID}`,
                            color: T.TEXT_MUTED,
                        }}
                    >
                        {mainNote}
                    </p>
                ) : null}
                {entrySegment && fieldLabelFor(entrySegment.key) ? (
                    <WrittenTo label={fieldLabelFor(entrySegment.key)!} />
                ) : null}
            </div>

            <div
                className="rounded-xl overflow-hidden"
                style={{
                    background: T.SURFACE,
                    border: `1px solid ${T.BORDER}`,
                }}
            >
                <div
                    className="flex items-center gap-2.5 px-5 py-3"
                    style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                >
                    <span
                        className="text-[13px] font-semibold"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {td("Everything else on this call", { source: "en" })}
                    </span>
                    <span className="flex-1" />
                    <span
                        className="text-[12px]"
                        style={{ color: T.TEXT_HINT }}
                    >
                        {call.answers?.length ?? 0}{" "}
                        {td("answers", { source: "en" })}
                    </span>
                </div>

                {rows.length ? (
                    rows.map((row) => (
                        <div
                            key={row.key}
                            className="grid gap-4 px-5 py-3 items-baseline"
                            style={{
                                gridTemplateColumns: "minmax(0, 1fr) 240px",
                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <div className="min-w-0">
                                <p
                                    className="m-0 text-[13px] leading-relaxed"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {row.question}
                                </p>
                                <p
                                    className="mt-1 mb-0 text-[14px] font-semibold leading-relaxed break-words"
                                    style={{ color: T.TEXT }}
                                >
                                    {row.answer}
                                </p>
                                {row.note ? (
                                    <p
                                        className="mt-1 mb-0 text-[12px] leading-relaxed"
                                        style={{ color: T.TEXT_HINT }}
                                    >
                                        {row.note}
                                    </p>
                                ) : null}
                            </div>
                            <div>
                                {row.field ? (
                                    <WrittenTo label={row.field} compact />
                                ) : null}
                            </div>
                        </div>
                    ))
                ) : (
                    <p
                        className="m-0 px-5 py-4 text-[13px]"
                        style={{ color: T.TEXT_HINT }}
                    >
                        {td("No other answers captured on this call.", {
                            source: "en",
                        })}
                    </p>
                )}

                <p
                    className="m-0 px-5 py-3 text-[12px]"
                    style={{ background: T.SURFACE_2, color: T.TEXT_HINT }}
                >
                    {td("Questions the branch skipped are not listed.", {
                        source: "en",
                    })}
                    {abandonedCount
                        ? ` · ${abandonedCount} ${td("abandoned", { source: "en" })}`
                        : ""}
                </p>
            </div>

            <ConfirmDialog
                open={confirmDeleteOpen}
                title={td("Delete qualification call?", { source: "en" })}
                message={td(
                    "This permanently removes the call and its answers. This cannot be undone.",
                    { source: "en" },
                )}
                confirmLabel={td("Delete", { source: "en" })}
                cancelLabel={td("Cancel", { source: "en" })}
                danger
                confirmLoading={deleting}
                onConfirm={() => void handleDeleteConfirm()}
                onCancel={() => {
                    if (!deleting) setConfirmDeleteOpen(false);
                }}
            />
        </div>
    );
}

/** The bar takes the selected call's state — outcome when done, status otherwise. */
function StatusBar({
    call,
    when,
    onResume,
    onDelete,
}: {
    call: LeadQualification;
    when: string;
    onResume?: () => void;
    onDelete?: () => void;
}) {
    const { td } = useTd();
    const tone = callTone(call);
    const style = BAR_STYLE[tone];
    const keys = outcomeKeys(call);

    const headline =
        call.status === "inProgress"
            ? td("Call still in progress", { source: "en" })
            : call.status === "abandoned"
              ? td("Call abandoned", { source: "en" })
              : keys.length
                ? keys
                      .map((key) =>
                          td(
                              COMPLETED_OUTCOME_LABELS[key] ??
                                  DEFAULT_OUTCOME_LABELS[key] ??
                                  key,
                              { source: "en" },
                          ),
                      )
                      .join(" · ")
                : td("Call completed", { source: "en" });

    const iconName =
        call.status === "completed" && keys[0]
            ? (OUTCOME_ICON[keys[0]] ?? "info")
            : call.status === "inProgress"
              ? "clock"
              : "ban";

    const sub =
        call.outcome_comment?.trim() ||
        `${when}${call.agent?.name ? ` · ${call.agent.name}` : ""}`;

    return (
        <div
            className="flex items-center gap-4 px-5 py-4 rounded-xl"
            style={{ background: style.bg, border: `1px solid ${style.border}` }}
        >
            <Icon name={iconName} size={20} color={style.icon} />
            <div className="flex-1 min-w-0">
                <p
                    className="m-0 text-[16px] font-bold truncate"
                    style={{ color: style.title }}
                >
                    {headline}
                </p>
                <p
                    className="mt-1 mb-0 text-[12px] truncate"
                    style={{ color: style.sub }}
                >
                    {sub}
                </p>
            </div>
            {call.status === "inProgress" && onResume ? (
                <Button
                    size="sm"
                    variant="primary"
                    icon={<Icon name="phone" size={13} />}
                    onClick={onResume}
                >
                    {td("Resume call", { source: "en" })}
                </Button>
            ) : null}
            {onDelete ? (
                <Button
                    size="sm"
                    aria-label={td("Delete call", { source: "en" })}
                    icon={<Icon name="trash" size={13} />}
                    onClick={onDelete}
                />
            ) : null}
        </div>
    );
}

function WrittenTo({ label, compact }: { label: string; compact?: boolean }) {
    const { td } = useTd();
    return (
        <span
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${compact ? "" : "mt-3"}`}
            style={{ color: T.NAVY }}
        >
            <Icon name="refresh" size={13} />
            {compact ? label : `${td("Written to", { source: "en" })} ${label}`}
        </span>
    );
}

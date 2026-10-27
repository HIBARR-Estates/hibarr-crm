import { useEffect, useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Button from "@/Components/Redesign/primitives/Button";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import HtmlEditor from "@/Components/HtmlEditor/HtmlEditor";
import HtmlRenderer from "@/Components/ContentRenderer/HtmlRenderer";
import MarkdownRenderer from "@/Components/ContentRenderer/MarkdownRenderer";
import useSallyInsightMutations, {
    SallyInsightPatch,
} from "@/Components/Redesign/sally/useSallyInsightMutations";
import useSallySuggestionMutations from "@/Components/Redesign/sally/useSallySuggestionMutations";
import {
    normalizeSummary,
    summaryShape,
    summaryToEditorHtml,
} from "@/Components/Redesign/sally/summaryContent";
import { formatMeetingDateTime } from "@/Pages/Meetings/Redesign/adapters/meetingTimeLabel";
import type {
    SallyMeetingInsight,
    SallySuggestedNote,
    SallySuggestionType,
    SallyTranscriptSegment,
} from "@/Types/api/sally-meeting-insight";

function formatSegmentTime(
    start?: number | null,
    end?: number | null,
): string | null {
    if (start == null && end == null) {
        return null;
    }
    const fmt = (value: number) => {
        const mins = Math.floor(value / 60);
        const secs = Math.floor(value % 60);
        return `${mins}:${String(secs).padStart(2, "0")}`;
    };
    if (start != null && end != null) {
        return `${fmt(start)}–${fmt(end)}`;
    }
    if (start != null) {
        return fmt(start);
    }
    return end != null ? fmt(end) : null;
}

function orderedSegments(
    segments: SallyTranscriptSegment[] | undefined,
): SallyTranscriptSegment[] {
    if (!segments?.length) {
        return [];
    }
    return [...segments].sort((a, b) => {
        const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (order !== 0) {
            return order;
        }
        return (a.startTime ?? 0) - (b.startTime ?? 0);
    });
}

function TranscriptBody({
    segments,
    transcriptText,
    label,
}: {
    segments: SallyTranscriptSegment[];
    transcriptText: string;
    label: string;
}) {
    if (segments.length === 0) {
        return (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-dr-text-muted">
                {transcriptText}
            </p>
        );
    }

    return (
        <div
            className="max-h-[60vh] space-y-2 overflow-y-auto overscroll-contain pr-1 text-sm"
            role="group"
            aria-label={label}
            tabIndex={0}
        >
            {segments.map((segment, index) => {
                const speaker = segment.speakerName?.trim();
                const timeLabel = formatSegmentTime(
                    segment.startTime,
                    segment.endTime,
                );
                return (
                    <div key={segment.id ?? `tr-${index}`}>
                        {speaker || timeLabel ? (
                            <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                                {speaker ? (
                                    <span className="font-semibold text-dr-text">
                                        {speaker}
                                    </span>
                                ) : null}
                                {timeLabel ? (
                                    <span className="text-[11px] tabular-nums text-dr-text-hint">
                                        {timeLabel}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                        <p className="text-dr-text-muted">{segment.text}</p>
                    </div>
                );
            })}
        </div>
    );
}

/** Stand-in patcher for read-only cards, which still mount the mutation hook. */
const noopPatch: SallyInsightPatch = () => undefined;

type Td = (text: string, options: { source: "en" }) => string;

/**
 * A summary arrives in one of three shapes, and they need different renderers:
 *
 * - HTML — once a human edited it in the rich-text editor.
 * - Markdown — Sally's own output, which uses **bold**, lists and paragraphs.
 *   Rendered as markdown so the emphasis actually shows; left untranslated,
 *   because td() would mangle the markers.
 * - Plain prose — still translatable, so it goes through td().
 *
 * normalizeSummary() runs first, so a row stored before the ingest fix still
 * breaks into paragraphs instead of showing literal "\n".
 */
function SummaryBody({ summary, td }: { summary: string; td: Td }) {
    const normalized = normalizeSummary(summary);
    const shape = summaryShape(normalized);

    if (shape === "html") {
        return (
            <HtmlRenderer content={normalized} className="text-sm text-dr-text" />
        );
    }

    if (shape === "markdown") {
        return (
            <MarkdownRenderer
                content={normalized}
                className="text-sm text-dr-text"
            />
        );
    }

    return (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-dr-text">
            {td(normalized, { source: "en" })}
        </p>
    );
}

/** Badge colour per suggested-note kind. */
const suggestionBadgeVariant: Record<
    SallySuggestionType,
    "blue" | "green" | "navy" | "amber" | "teal"
> = {
    objection: "amber",
    decision: "blue",
    insight: "teal",
    meeting_type: "navy",
};

/**
 * One of Sally's suggested notes. Owns its mutations (the routes carry the
 * suggestion id, so the hook is mounted per item) and its inline editor.
 *
 * - "Add as note" turns the suggestion into a normal CRM note. When the agent
 *   edited the text first, the current wording is sent (logged "after edit");
 *   otherwise Sally's wording is logged verbatim.
 * - A logged suggestion is frozen: its text can no longer be edited, because
 *   the note it became carries exactly what was logged.
 */
function SuggestedNoteItem({
    insightId,
    suggestion,
    patch,
    canEdit,
}: {
    insightId: number;
    suggestion: SallySuggestedNote;
    patch: SallyInsightPatch;
    canEdit: boolean;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { saveSuggestion, logSuggestion, isSaving, isLogging } =
        useSallySuggestionMutations(insightId, suggestion.id, patch);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(suggestion.text);

    useEffect(() => {
        setDraft(suggestion.text);
    }, [suggestion.id, suggestion.text]);

    const startEditing = () => {
        setDraft(suggestion.text);
        setEditing(true);
    };

    const save = () => {
        const next = draft.trim();
        if (next === "" || next === suggestion.text.trim()) {
            setEditing(false);
            return;
        }
        saveSuggestion(next, () => setEditing(false));
    };

    const addAsNote = () => {
        // An edited suggestion logs its current wording; an untouched one logs
        // Sally's text verbatim (the server records which of the two).
        logSuggestion(suggestion.edited ? suggestion.text : null);
    };

    return (
        <li className="rounded-lg border border-dr-border bg-dr-surface p-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={suggestionBadgeVariant[suggestion.type]}>
                        {t(
                            `pages.deals.sally.suggestion_types.${suggestion.type}`,
                        )}
                    </Badge>
                    {suggestion.logged ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-dr-green">
                            <Icon name="check-square" size={13} />
                            {t("pages.deals.sally.added_as_note")}
                        </span>
                    ) : null}
                    {suggestion.logged ? (
                        <span className="text-[11px] text-dr-text-muted">
                            {t(
                                `pages.deals.sally.logged.${
                                    suggestion.logged_mode === "after_edit"
                                        ? "after_edit"
                                        : "as_is"
                                }`,
                            )}
                        </span>
                    ) : null}
                </div>
                {canEdit && !suggestion.logged && !editing ? (
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={startEditing}
                            className="cursor-pointer text-[11px] text-dr-text-muted hover:underline"
                        >
                            {t("pages.deals.sally.edit")}
                        </button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={addAsNote}
                            loading={isLogging}
                            icon={<Icon name="plus" size={12} />}
                        >
                            {t("pages.deals.sally.add_as_note")}
                        </Button>
                    </div>
                ) : null}
            </div>
            {editing ? (
                <div className="mt-2">
                    <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-dr-border bg-dr-surface-2 px-3 py-2 text-sm text-dr-text focus:outline-none"
                        aria-label={t("pages.deals.sally.suggestion_editor")}
                    />
                    <div className="mt-1.5 flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(false)}
                        >
                            {t("pages.deals.sally.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={save}
                            disabled={draft.trim() === ""}
                            loading={isSaving}
                        >
                            {t("pages.deals.sally.save")}
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-dr-text">
                    {td(suggestion.text, { source: "en" })}
                </p>
            )}
        </li>
    );
}

interface SallyInsightCardProps {
    insight: SallyMeetingInsight;
    /** Deal name on the lead workspace, where an insight may belong to a deal. */
    groupLabel?: string;
    /**
     * Enables the card's editable fields (summary, key points, suggested
     * notes). It patches the owning workspace list in place; the mutations
     * themselves are per-insight, because the routes are keyed by insight id.
     */
    patchInsight?: SallyInsightPatch;
    /** Callback to turn the insight's summary + bullet points into a CRM note. */
    onAddNote?: (content: string) => void;
}

export default function SallyInsightCard({
    insight,
    groupLabel,
    patchInsight,
    onAddNote,
}: SallyInsightCardProps) {
    const { t } = useTranslation();
    // Summary and bullets are server-generated English, so they go through the
    // dynamic translator like the AI-summary card does.
    const { td } = useTd();

    const [summaryOpen, setSummaryOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    // The draft holds HTML: the editor is rich text, and it is seeded by
    // converting whatever shape the stored summary has (see summaryContent).
    const [draft, setDraft] = useState(() =>
        summaryToEditorHtml(insight.summary),
    );
    const [bulletsEditing, setBulletsEditing] = useState(false);
    // One key point per line while editing; split on save.
    const [bulletsDraft, setBulletsDraft] = useState("");
    const [transcriptOpen, setTranscriptOpen] = useState(false);
    // "Edit then add to note" editor state.
    const [noteEditing, setNoteEditing] = useState(false);
    const [noteDraft, setNoteDraft] = useState("");

    // Always called (hooks can't be conditional), but inert without a patcher.
    const { updateSummary, updateBulletPoints, isUpdating } =
        useSallyInsightMutations(insight.id, patchInsight ?? noopPatch);

    const canEdit = patchInsight !== undefined;

    // Keep the draft in step with the record when it changes underneath us
    // (another tab saved, or the card was re-seeded for a different entity).
    useEffect(() => {
        setDraft(summaryToEditorHtml(insight.summary));
    }, [insight.id, insight.summary]);

    // Same formatter the Meetings tab uses, so a meeting booked in another
    // IANA zone reads identically in both places.
    const meetingWhen = insight.meeting?.next_follow_up_date
        ? formatMeetingDateTime(insight.meeting.next_follow_up_date, {
              timezone: insight.meeting.timezone,
          })
        : null;
    const meetingTitle =
        insight.meeting?.remark?.trim() ||
        t("pages.deals.sally.meeting_fallback");
    const segments = useMemo(
        () => orderedSegments(insight.transcript_segments),
        [insight.transcript_segments],
    );
    const transcriptText = normalizeSummary(insight.transcript).trim();
    // Bullets can carry the same literal escapes as the summary on old rows.
    const bullets = (insight.bullet_points ?? []).map(normalizeSummary);
    const hasTranscript = segments.length > 0 || transcriptText !== "";
    const suggestions = insight.suggested_notes ?? [];

    // Both sides are HTML, so compare on rendered text — Quill and marked emit
    // different markup for identical content ("<p>a</p>" vs "a<br>").
    const asText = (html: string) =>
        html
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const startEditing = () => {
        setDraft(summaryToEditorHtml(insight.summary));
        setEditing(true);
    };

    const cancelEditing = () => {
        setDraft(summaryToEditorHtml(insight.summary));
        setEditing(false);
    };

    // Stay in edit mode until the server accepts: a failed save would
    // otherwise discard whatever the user just typed.
    const closeEditor = () => setEditing(false);

    const saveSummary = () => {
        const next = draft.trim();
        const current = summaryToEditorHtml(insight.summary);

        if (asText(next) === "") {
            if (asText(current) !== "") {
                updateSummary(null, closeEditor);
            } else {
                closeEditor();
            }
            return;
        }

        if (asText(next) === asText(current)) {
            closeEditor();
            return;
        }

        updateSummary(next, closeEditor);
    };

    const startBulletsEditing = () => {
        setBulletsDraft(bullets.join("\n"));
        setBulletsEditing(true);
    };

    const saveBullets = () => {
        const lines = bulletsDraft
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line !== "");

        if (
            lines.length === bullets.length &&
            lines.every((line, index) => line === bullets[index]?.trim())
        ) {
            setBulletsEditing(false);
            return;
        }

        updateBulletPoints(lines, () => setBulletsEditing(false));
    };

    /** Compose the note body from the summary and bullet points. */
    const noteContent = useMemo(() => {
        const summaryText = asText(insight.summary ?? "");
        const bulletText = bullets.length > 0
            ? `\n\nKey points:\n${bullets.map((b) => `- ${b}`).join("\n")}`
            : "";
        return `${summaryText}${bulletText}`.trim();
    }, [insight.summary, bullets, asText]);

    const startNoteEditing = () => {
        setNoteDraft(noteContent);
        setNoteEditing(true);
    };

    const cancelNoteEditing = () => setNoteEditing(false);

    const saveNote = () => {
        const next = noteDraft.trim();
        if (next === "") {
            setNoteEditing(false);
            return;
        }
        onAddNote?.(next);
        setNoteEditing(false);
    };

    const addToNoteDirectly = () => {
        const content = noteContent.trim();
        if (content === "") return;
        onAddNote?.(content);
    };

    return (
        <article className="rounded-xl border border-dr-border bg-dr-surface-2 p-4">
            {groupLabel ? (
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-dr-text-muted">
                    {groupLabel}
                </div>
            ) : null}
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-dr-text">
                        {meetingTitle}
                    </h3>
                    {meetingWhen ? (
                        <p className="mt-0.5 text-xs text-dr-text-muted">
                            {meetingWhen}
                        </p>
                    ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {insight.recording_url ? (
                        // External recording — always a browser tab, never an
                        // in-app navigation, so the agent keeps their place.
                        <a
                            href={insight.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dr-btn dr-btn-ghost"
                        >
                            <Icon name="video" size={15} />
                            {t("pages.deals.sally.view_recording")}
                        </a>
                    ) : null}
                    {hasTranscript ? (
                        <Button
                            variant="ghost"
                            onClick={() => setTranscriptOpen(true)}
                            icon={<Icon name="file-text" size={15} />}
                        >
                            {t("pages.deals.sally.view_transcript")}
                        </Button>
                    ) : null}
                </div>
            </div>

            {/* Summary: collapsed by default, and the one editable part. */}
            <section className="mb-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => setSummaryOpen((prev) => !prev)}
                        aria-expanded={summaryOpen}
                        className="dr-label flex cursor-pointer items-center gap-1.5"
                    >
                        <Icon
                            name={summaryOpen ? "chevron-down" : "chevron-right"}
                            size={12}
                        />
                        {t("pages.deals.sally.summary")}
                    </button>
                    {canEdit && !editing ? (
                        <button
                            type="button"
                            onClick={startEditing}
                            className="cursor-pointer text-[11px] text-dr-text-muted hover:underline"
                        >
                            {t("pages.deals.sally.edit")}
                        </button>
                    ) : null}
                </div>
                {summaryOpen ? (
                    editing ? (
                        <div>
                            <HtmlEditor
                                value={draft}
                                onChange={setDraft}
                                height={180}
                                placeholder={t(
                                    "pages.deals.sally.summary_placeholder",
                                )}
                            />
                            <div className="mt-2 flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={cancelEditing}
                                >
                                    {t("pages.deals.sally.cancel")}
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={saveSummary}
                                    loading={isUpdating}
                                >
                                    {t("pages.deals.sally.save")}
                                </Button>
                            </div>
                        </div>
                    ) : insight.summary ? (
                        <SummaryBody summary={insight.summary} td={td} />
                    ) : (
                        <p className="text-sm text-dr-text-muted">
                            {t("pages.deals.sally.no_summary")}
                        </p>
                    )
                ) : null}
            </section>

            {/* Key points: Sally's list, corrected line by line by the team. */}
            <section className="mb-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h4 className="dr-label">
                        {t("pages.deals.sally.bullet_points")}
                    </h4>
                    {canEdit && !bulletsEditing ? (
                        <button
                            type="button"
                            onClick={startBulletsEditing}
                            className="cursor-pointer text-[11px] text-dr-text-muted hover:underline"
                        >
                            {t("pages.deals.sally.edit")}
                        </button>
                    ) : null}
                </div>
                {bulletsEditing ? (
                    <div>
                        <textarea
                            value={bulletsDraft}
                            onChange={(event) =>
                                setBulletsDraft(event.target.value)
                            }
                            rows={Math.max(3, bullets.length + 1)}
                            placeholder={t(
                                "pages.deals.sally.bullets_placeholder",
                            )}
                            className="w-full rounded-lg border border-dr-border bg-dr-surface-2 px-3 py-2 text-sm text-dr-text focus:outline-none"
                            aria-label={t("pages.deals.sally.bullet_points")}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => setBulletsEditing(false)}
                            >
                                {t("pages.deals.sally.cancel")}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={saveBullets}
                                loading={isUpdating}
                            >
                                {t("pages.deals.sally.save")}
                            </Button>
                        </div>
                    </div>
                ) : bullets.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-4 text-sm text-dr-text">
                        {bullets.map((point, index) =>
                            point.trim() === "" ? null : (
                                <li key={`${insight.id}-bp-${index}`}>
                                    {td(point, { source: "en" })}
                                </li>
                            ),
                        )}
                    </ul>
                ) : (
                    <p className="text-sm text-dr-text-muted">
                        {t("pages.deals.sally.no_bullet_points")}
                    </p>
                )}
            </section>

            {/* Suggested notes: Sally's proposals for the notes tab. Agents
                can reword them and log them as normal CRM notes; a logged one
                is frozen so the note it became stays in sync. */}
            {suggestions.length > 0 ? (
                <section>
                    <h4 className="dr-label mb-1.5">
                        {t("pages.deals.sally.suggested_notes")}
                    </h4>
                    <ul className="space-y-2">
                        {suggestions.map((suggestion) => (
                            <SuggestedNoteItem
                                key={`${insight.id}-${suggestion.id}`}
                                insightId={insight.id}
                                suggestion={suggestion}
                                patch={patchInsight ?? noopPatch}
                                canEdit={canEdit}
                            />
                        ))}
                    </ul>
                </section>
            ) : null}

            {/* Add to note: turn the insight summary + key points into a CRM note. */}
            {onAddNote ? (
                <section className="mt-4 pt-4 border-t border-dr-border">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-dr-text-muted">
                            {t("pages.deals.sally.description")}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={addToNoteDirectly}
                                disabled={noteContent.trim() === ""}
                                icon={<Icon name="plus" size={12} />}
                            >
                                {t("pages.deals.sally.add_to_note")}
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={startNoteEditing}
                                disabled={noteContent.trim() === ""}
                                icon={<Icon name="edit" size={12} />}
                            >
                                {t("pages.deals.sally.edit_then_add_to_note")}
                            </Button>
                        </div>
                    </div>
                </section>
            ) : null}

            {/* "Edit then add to note" inline editor. */}
            {noteEditing && onAddNote ? (
                <div className="mt-3">
                    <textarea
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-dr-border bg-dr-surface-2 px-3 py-2 text-sm text-dr-text focus:outline-none"
                        aria-label={t("pages.deals.sally.note_editor")}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelNoteEditing}
                        >
                            {t("pages.deals.sally.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={saveNote}
                            disabled={noteDraft.trim() === ""}
                        >
                            {t("pages.deals.sally.save")}
                        </Button>
                    </div>
                </div>
            ) : null}

            {/* Transcript lives in a read-only dialog — it is the source
                recording, not CRM copy, so it is never edited inline. */}
            {transcriptOpen ? (
                <Modal
                    open={transcriptOpen}
                    onClose={() => setTranscriptOpen(false)}
                    title={t("pages.deals.sally.transcript")}
                    subtitle={meetingTitle}
                    closeAriaLabel={t("common.close")}
                    closeOnBackdrop
                    maxWidth={720}
                >
                    <TranscriptBody
                        segments={segments}
                        transcriptText={transcriptText}
                        label={t("pages.deals.sally.transcript")}
                    />
                </Modal>
            ) : null}
        </article>
    );
}

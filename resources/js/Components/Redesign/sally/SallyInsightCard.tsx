import { useEffect, useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import HtmlEditor from "@/Components/HtmlEditor/HtmlEditor";
import HtmlRenderer from "@/Components/ContentRenderer/HtmlRenderer";
import MarkdownRenderer from "@/Components/ContentRenderer/MarkdownRenderer";
import useSallyInsightMutations from "@/Components/Redesign/sally/useSallyInsightMutations";
import {
    normalizeSummary,
    summaryShape,
    summaryToEditorHtml,
} from "@/Components/Redesign/sally/summaryContent";
import { formatMeetingDateTime } from "@/Pages/Meetings/Redesign/adapters/meetingTimeLabel";
import type {
    SallyMeetingInsight,
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
const noop = () => undefined;

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

interface SallyInsightCardProps {
    insight: SallyMeetingInsight;
    /** Deal name on the lead workspace, where an insight may belong to a deal. */
    groupLabel?: string;
    /**
     * Enables the summary's inline edit. It patches the owning workspace list
     * in place; the mutation itself is per-insight, because the update route
     * is `/sally-insights/{insight}`.
     */
    onSummaryChange?: (insightId: number, summary: string | null) => void;
}

export default function SallyInsightCard({
    insight,
    groupLabel,
    onSummaryChange,
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
    const [transcriptOpen, setTranscriptOpen] = useState(false);

    // Always called (hooks can't be conditional), but inert without a patcher.
    const { updateSummary, isUpdating } = useSallyInsightMutations(
        insight.id,
        onSummaryChange ?? noop,
    );

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
                    {onSummaryChange && !editing ? (
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

            {bullets.length > 0 ? (
                <section className="mb-3">
                    <h4 className="dr-label mb-1.5">
                        {t("pages.deals.sally.bullet_points")}
                    </h4>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-dr-text">
                        {bullets.map((point, index) =>
                            point.trim() === "" ? null : (
                                <li key={`${insight.id}-bp-${index}`}>
                                    {td(point, { source: "en" })}
                                </li>
                            ),
                        )}
                    </ul>
                </section>
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

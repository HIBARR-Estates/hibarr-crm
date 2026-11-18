import { Suspense, lazy, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import {
    DEFAULT_MEETING_REMINDERS,
    VIDEO_PROVIDER_OPTIONS,
    buildEmptyMeetingForm,
    canUseZohoMeeting,
    getMeetingOwner,
    requiresManualMeetingLink,
    type MeetingFormState,
    type MeetingPlatform,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import useMeetingTypesForSchedule from "@/Components/Redesign/meeting/useMeetingTypesForSchedule";
import useMeetingsScheduleCreate from "@/Components/Redesign/meeting/useMeetingsScheduleCreate";
import useScheduleRecordSource, { recordKey } from "@/Components/Redesign/meeting/useScheduleRecordSource";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import ModalShell from "@/Components/Redesign/primitives/ModalShell";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useMediaQuery from "@/Hooks/useMediaQuery";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { emptyTaskForm } from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import type { TaskPriorityKey } from "@/Pages/Tasks/Redesign/config/taskDesignTokens";
import useAgentTaskCreate from "../tasks/useAgentTaskCreate";
import { firstName, tomorrowIn, type DoNextRequest, type DoNextSaved } from "./doNext";
import "./donext.css";

const MeetingScheduleModal = lazy(() => import("@/Components/Redesign/modals/MeetingScheduleModal"));

type Kind = "task" | "meeting";

const PRIORITIES: TaskPriorityKey[] = ["low", "medium", "high", "urgent"];
const DEFAULT_TIME = "10:00";
/** Popover width on desktop and tablet (canvas L7-43). */
const WIDTH = 600;
/** Where the caret sits from the popover's left edge. */
const CARET = 86;

interface DoNextPromptProps {
    request: DoNextRequest;
    /** Closed with nothing added: Skip for now, Escape or the close button. */
    onClose: () => void;
    /** A next step was saved; the prompt closes after this. */
    onSaved: (saved: DoNextSaved) => void;
    /** The meeting's outcome (from the report) was saved. */
    onReported?: () => void;
    /** "All meeting fields": the page's own schedule form; the CRM's dialog when left out. */
    onAllMeetingFields?: () => void;
}

/**
 * Do next (canvas L7-43 to L7-45): once a task is done or a meeting held,
 * the agent adds the next step for the same deal or person in place, as a
 * short task or a short version of Schedule meeting, or skips. Opens under
 * the row that was finished; a bottom sheet on a phone, a dialog where there
 * is no row. Suggestions from the next-move rules are held until that
 * feature exists, so the form starts empty.
 */
export default function DoNextPrompt({ request, onClose, onSaved, onReported, onAllMeetingFields }: DoNextPromptProps) {
    const isPhone = useMediaQuery("(max-width: 639px)");
    const [allFields, setAllFields] = useState(false);
    const titleId = useId();
    const { record } = request;

    const body = (
        <DoNextBody
            request={request}
            titleId={titleId}
            onClose={onClose}
            onSaved={onSaved}
            onReported={onReported}
            onAllMeetingFields={() => {
                if (onAllMeetingFields) {
                    onClose();
                    onAllMeetingFields();
                } else setAllFields(true);
            }}
        />
    );

    if (allFields) {
        return (
            <Suspense fallback={null}>
                <MeetingScheduleModal
                    open
                    onClose={onClose}
                    userDeals={record.type === "deal" ? [{ id: record.id, name: record.name }] : []}
                    userLeads={record.type === "lead" ? [{ id: record.id, name: record.name }] : []}
                    initialRecord={{ type: record.type, id: record.id }}
                    onSuccess={() => onSaved({ kind: "meeting", meeting: undefined })}
                />
            </Suspense>
        );
    }

    if (isPhone || !request.anchor) {
        return (
            <ModalShell
                open
                onClose={onClose}
                ariaLabelledBy={titleId}
                initialFocus="first"
                trapFocus
                overlayClassName={isPhone ? "agent-sheet-overlay" : undefined}
                panelClassName={isPhone ? "agent-sheet agent-dn agent-dn--sheet" : "agent-dn agent-dn--dialog"}
            >
                {body}
            </ModalShell>
        );
    }

    return (
        <Anchored anchor={request.anchor} labelledBy={titleId} onEscape={onClose}>
            {body}
        </Anchored>
    );
}

/** The popover under a row: placed from the row, kept inside the window, with a caret. */
function Anchored({ anchor, labelledBy, onEscape, children }: { anchor: HTMLElement; labelledBy: string; onEscape: () => void; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [place, setPlace] = useState<{ top: number; left: number; width: number; caret: number } | null>(null);
    const last = useRef<DOMRect | null>(null);

    const measure = useCallback(() => {
        // The row may leave the list (a ticked task); keep the last place it had.
        const rect = anchor.isConnected ? anchor.getBoundingClientRect() : last.current;
        if (!rect) return;
        last.current = rect;
        const viewport = document.documentElement.clientWidth;
        const width = Math.min(WIDTH, viewport - 32);
        // The caret points at a small anchor's middle (a button), or a little
        // way into a row, as on the boards.
        const point = rect.width < 320 ? rect.left + rect.width / 2 : rect.left + Math.min(208, rect.width * 0.15) + CARET;
        const left = Math.max(16, Math.min(point - CARET, viewport - width - 16));
        setPlace({
            top: rect.bottom + window.scrollY + 10,
            left: left + window.scrollX,
            width,
            caret: Math.max(20, Math.min(point - left, width - 20)),
        });
    }, [anchor]);

    useLayoutEffect(() => {
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [measure]);

    // Bring it into view and put the cursor in its first field.
    useEffect(() => {
        if (!place || !ref.current) return;
        ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
        ref.current.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true });
        // Once, when it first lands.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [place !== null]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented) onEscape();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onEscape]);

    if (!place) return null;

    return createPortal(
        <div
            ref={ref}
            role="dialog"
            aria-labelledby={labelledBy}
            className="agent-dn agent-dn--popover"
            style={{ top: place.top, left: place.left, width: place.width, ["--caret" as string]: `${place.caret}px` }}
        >
            {children}
        </div>,
        document.body,
    );
}

interface BodyProps {
    request: DoNextRequest;
    titleId: string;
    onClose: () => void;
    onSaved: (saved: DoNextSaved) => void;
    onReported?: () => void;
    onAllMeetingFields: () => void;
}

function DoNextBody({ request, titleId, onClose, onSaved, onReported, onAllMeetingFields }: BodyProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { timezone } = useUserDateTime();
    const { props } = usePage<PageProps>();
    const userId = props.auth?.user?.id as number | undefined;
    const userName = (props.auth?.user?.name as string | undefined) ?? "";
    const userEmail = props.auth?.user?.email as string | undefined;
    const { record, done, report } = request;
    const key = "pages.agent_workspace.do_next";
    const name = record.type === "lead" ? firstName(record.person ?? record.name) || record.name : record.name;

    const [kind, setKind] = useState<Kind>("task");
    const [title, setTitle] = useState("");
    const [dueDate, setDueDate] = useState(() => tomorrowIn(timezone));
    const [dueTime, setDueTime] = useState(DEFAULT_TIME);
    const [priority, setPriority] = useState<TaskPriorityKey>("medium");
    const [reportText, setReportText] = useState("");
    const [reportError, setReportError] = useState<string | null>(null);
    const [reporting, setReporting] = useState(false);
    const reported = useRef(false);

    // The meeting form, seeded from the record's people once they load.
    const { source, loading: sourceLoading, error: sourceError } = useScheduleRecordSource(recordKey(record.type, record.id));
    const meetingTypes = useMeetingTypesForSchedule(undefined, true);
    const [meeting, setMeeting] = useState<MeetingFormState | null>(null);
    useEffect(() => {
        if (meeting || sourceLoading || (!source && !sourceError)) return;
        setMeeting({
            ...buildEmptyMeetingForm(source, userId, userEmail),
            date: tomorrowIn(timezone),
            startTime: DEFAULT_TIME,
            reminders: DEFAULT_MEETING_REMINDERS,
        });
    }, [meeting, source, sourceError, sourceLoading, timezone, userEmail, userId]);
    const owner = useMemo(() => getMeetingOwner(source), [source]);
    const { createMeeting, isCreating, errors: meetingErrors, clearErrors } = useMeetingsScheduleCreate();

    const taskCreate = useAgentTaskCreate({ onCreated: (task) => onSaved({ kind: "task", task }) });
    const saving = taskCreate.saving || isCreating || reporting;

    // The meeting's outcome goes in once, with the report, whichever button closes this.
    const saveReport = async (): Promise<boolean> => {
        if (!report || reported.current) return true;
        setReporting(true);
        setReportError(null);
        try {
            const { data } = await axios.post(route("meetings.api.attendance_confirmation.confirm", { followUp: report.meetingId }), {
                outcome: "attended",
                note: reportText.trim() || null,
            });
            if (data?.status === "fail") throw new Error(String(data.message ?? ""));
            reported.current = true;
            onReported?.();
            return true;
        } catch {
            setReportError(t(`${key}.report_failed`));
            return false;
        } finally {
            setReporting(false);
        }
    };

    const skip = async () => {
        if (saving) return;
        if (await saveReport()) onClose();
    };

    const add = async () => {
        if (saving) return;
        if (!(await saveReport())) return;
        if (kind === "task") {
            taskCreate.submit({
                ...emptyTaskForm(),
                title: title.trim(),
                dueDate,
                dueTime,
                priority,
                assignees: userId ? [userId] : [],
                links: [{ type: record.type, id: record.id, name: record.name }],
            });
            return;
        }
        if (!meeting) return;
        createMeeting(meeting, { type: record.type, id: record.id, hasOwner: owner !== null }, (created) =>
            onSaved({ kind: "meeting", meeting: created }),
        );
    };

    const status = record.status ? td(record.status, { source: "en" }) : "";
    const subtitle = t(`${key}.${record.type === "deal" ? "sub_deal" : "sub_lead"}${status ? "" : "_plain"}`, { name, status });
    const errors = [
        ...(reportError ? [reportError] : []),
        ...(kind === "task" ? taskCreate.errors : meetingErrors).map((error) => td(error, { source: "en" })),
        ...(kind === "meeting" && sourceError ? [t(sourceError)] : []),
    ];
    const canAdd = kind === "task" ? title.trim() !== "" && dueDate !== "" : meeting !== null;

    return (
        <div className="agent-dn__body">
            <header className="agent-dn__head">
                <span className="agent-dn__mark" aria-hidden="true">
                    <Icon name="arrow-right" size={16} />
                </span>
                <span className="agent-dn__heading">
                    <b id={titleId}>{t(`${key}.title`)}</b>
                    <small>{subtitle}</small>
                </span>
                <button type="button" className="agent-dn__close" onClick={onClose} disabled={saving} aria-label={t(`${key}.close_aria`)}>
                    <Icon name="x" size={16} />
                </button>
            </header>

            {done ? (
                <p className="agent-dn__done">
                    <span className="agent-dn__check" aria-hidden="true">
                        <Icon name="check" size={11} />
                    </span>
                    <span>
                        <b>{t(`${key}.${done.kind === "task" ? "done" : "held"}`)}</b> {done.label}
                    </span>
                </p>
            ) : null}

            <div className="agent-dn__kind">
                <Segmented<Kind>
                    value={kind}
                    onChange={(next) => {
                        setKind(next);
                        clearErrors();
                        taskCreate.clearErrors();
                    }}
                    variant="raised"
                    ariaLabel={t(`${key}.kind_aria`)}
                    options={[
                        { value: "task", label: t(`${key}.task`), icon: <Icon name="check" size={12} /> },
                        { value: "meeting", label: t(`${key}.meeting`), icon: <Icon name="calendar" size={12} /> },
                    ]}
                />
                {kind === "task" ? (
                    <label className="agent-dn__field agent-dn__field--grow">
                        <span>{t(`${key}.task_name`)}</span>
                        <input
                            className="agent-dn__input"
                            value={title}
                            maxLength={255}
                            placeholder={t(`${key}.task_placeholder`)}
                            onChange={(event) => setTitle(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") void add();
                            }}
                        />
                    </label>
                ) : (
                    <div className="agent-dn__short">
                        <span>{t(`${key}.short_meeting`)}</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icon name="external-link" size={13} />}
                            // The report goes in first, so the full form never loses it.
                            onClick={() => void saveReport().then((ok) => ok && onAllMeetingFields())}
                            disabled={saving}
                        >
                            {t(`${key}.all_fields`)}
                        </Button>
                    </div>
                )}
            </div>

            {kind === "task" ? (
                <div className="agent-dn__grid agent-dn__grid--task">
                    <div className="agent-dn__field">
                        <span id={`${titleId}-due`}>{t(`${key}.due`)}</span>
                        {/* One field on the boards ("Tue 10 Nov · 10:00"): the day and the time side by side. */}
                        <div className="agent-dn__input agent-dn__when" role="group" aria-labelledby={`${titleId}-due`}>
                            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label={t(`${key}.due_date`)} />
                            <span aria-hidden="true">·</span>
                            <input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} aria-label={t(`${key}.due_time`)} />
                        </div>
                    </div>
                    <label className="agent-dn__field">
                        <span>{t(`${key}.priority`)}</span>
                        <select className="agent-dn__input" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriorityKey)}>
                            {PRIORITIES.map((value) => (
                                <option key={value} value={value}>
                                    {t(`pages.agent_workspace.tasks.priority.${value}`)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Linked label={t(`${key}.linked`)} record={record} />
                </div>
            ) : (
                <MeetingFields
                    form={meeting}
                    onChange={(patch) => setMeeting((prev) => (prev ? { ...prev, ...patch } : prev))}
                    meetingTypes={meetingTypes}
                    person={record.person ?? record.name}
                    host={owner && owner.id !== userId ? owner.name : userName}
                    canZoho={canUseZohoMeeting(userEmail)}
                />
            )}

            {report ? (
                <label className="agent-dn__field">
                    <span>{t(`${key}.report`)}</span>
                    <textarea
                        className="agent-dn__input agent-dn__textarea"
                        rows={2}
                        maxLength={2000}
                        value={reportText}
                        placeholder={t(`${key}.report_placeholder`)}
                        onChange={(event) => setReportText(event.target.value)}
                        disabled={reported.current}
                    />
                </label>
            ) : null}

            {errors.length > 0 ? (
                <ul className="agent-dn__errors" role="alert">
                    {errors.map((error) => (
                        <li key={error}>{error}</li>
                    ))}
                </ul>
            ) : null}

            <footer className="agent-dn__foot">
                <p>{record.type === "deal" ? t(`${key}.skip_note_deal`) : t(`${key}.skip_note_lead`, { name })}</p>
                <div className="agent-dn__actions">
                    <Button variant="ghost" onClick={() => void skip()} disabled={saving}>
                        {t(`${key}.skip`)}
                    </Button>
                    <Button variant="navy" icon={<Icon name="check" size={14} />} onClick={() => void add()} disabled={saving || !canAdd}>
                        {saving ? t(`${key}.saving`) : t(`${key}.add`)}
                    </Button>
                </div>
            </footer>
        </div>
    );
}

/** The record the next step goes on: fixed, as on the boards. */
function Linked({ label, record }: { label: string; record: DoNextRequest["record"] }) {
    // "Krüger · Bellapais villa": a deal reads with its person's surname, as in the task rows.
    const surname = record.type === "deal" ? (record.person ?? "").trim().split(/\s+/).pop() ?? "" : "";
    const name = surname && !record.name.toLowerCase().includes(surname.toLowerCase()) ? `${surname} · ${record.name}` : record.name;
    return (
        <div className="agent-dn__field">
            <span>{label}</span>
            <span className="agent-dn__readonly">
                <span className={`agent-dn__linked-mark agent-dn__linked-mark--${record.type}`} aria-hidden="true" />
                <span className="agent-dn__readonly-text">{name}</span>
            </span>
        </div>
    );
}

interface MeetingFieldsProps {
    form: MeetingFormState | null;
    onChange: (patch: Partial<MeetingFormState>) => void;
    meetingTypes: Array<{ id: number; name: string }>;
    person: string;
    host: string;
    canZoho: boolean;
}

/** The short version of Schedule meeting (L7-45): type, day, start, how, and who. */
function MeetingFields({ form, onChange, meetingTypes, person, host, canZoho }: MeetingFieldsProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const key = "pages.agent_workspace.do_next";

    const platforms = useMemo(() => {
        const video = VIDEO_PROVIDER_OPTIONS.filter((option) => option.value !== "zoho" || canZoho).map((option) => ({
            value: option.value as MeetingPlatform,
            label: `${t(`${key}.video_call`)} · ${option.label}`,
        }));
        return [
            ...video,
            { value: "office" as MeetingPlatform, label: `${t(`${key}.in_person`)} · ${t(`${key}.office`)}` },
            { value: "phone" as MeetingPlatform, label: t(`${key}.phone`) },
        ];
    }, [canZoho, t]);

    if (!form) {
        return (
            <div className="agent-dn__grid" aria-busy="true">
                {[0, 1, 2].map((index) => (
                    <div key={index} className="dr-skeleton" style={{ height: 58, borderRadius: 9 }} />
                ))}
            </div>
        );
    }

    const provider = VIDEO_PROVIDER_OPTIONS.find((option) => option.value === form.platform)?.label ?? "";

    return (
        <>
            <div className="agent-dn__grid">
                <label className="agent-dn__field">
                    <span>{t(`${key}.meeting_type`)}</span>
                    <select
                        className="agent-dn__input"
                        value={form.meetingTypeId ?? ""}
                        onChange={(event) => onChange({ meetingTypeId: event.target.value ? Number(event.target.value) : null })}
                    >
                        <option value="">{t(`${key}.type_placeholder`)}</option>
                        {meetingTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                                {td(type.name, { source: "en" })}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="agent-dn__field">
                    <span>{t(`${key}.date`)}</span>
                    <input type="date" className="agent-dn__input" value={form.date} onChange={(event) => onChange({ date: event.target.value })} />
                </label>
                <label className="agent-dn__field">
                    <span>{t(`${key}.start`)}</span>
                    <input type="time" className="agent-dn__input" value={form.startTime} onChange={(event) => onChange({ startTime: event.target.value })} />
                </label>
            </div>
            <div className="agent-dn__grid agent-dn__grid--two">
                <label className="agent-dn__field">
                    <span>{t(`${key}.platform`)}</span>
                    <select className="agent-dn__input" value={form.platform} onChange={(event) => onChange({ platform: event.target.value as MeetingPlatform, meetingLink: "" })}>
                        {platforms.map((option) => (
                            <option key={option.value} value={option.value}>
                                {td(option.label, { source: "en" })}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="agent-dn__field">
                    <span>{t(`${key}.participants`)}</span>
                    <span className="agent-dn__people">
                        <Person name={person} />
                        <Person name={host} note={t(`${key}.host`)} host />
                    </span>
                </div>
            </div>
            {requiresManualMeetingLink(form.platform) ? (
                <label className="agent-dn__field">
                    <span>{t(`${key}.meeting_link`)}</span>
                    <input
                        type="url"
                        className="agent-dn__input"
                        value={form.meetingLink}
                        placeholder={t(`${key}.link_placeholder`, { provider })}
                        onChange={(event) => onChange({ meetingLink: event.target.value })}
                    />
                </label>
            ) : null}
            <p className="agent-dn__hint">{t(`${key}.meeting_note`)}</p>
        </>
    );
}

function Person({ name, note, host = false }: { name: string; note?: string; host?: boolean }) {
    if (!name) return null;
    return (
        <span className={`agent-dn__person${host ? " agent-dn__person--host" : ""}`}>
            <span className="agent-dn__avatar" aria-hidden="true">
                {initialsFromName(name)}
            </span>
            <b>{name}</b>
            {note ? <small>{note}</small> : null}
        </span>
    );
}

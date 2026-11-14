import { useEffect, useMemo, useState, type ReactNode } from "react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useDealTimeline from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import useWorkspaceOverview from "@/Pages/Deals/Redesign/hooks/useWorkspaceOverview";
import type { LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Note } from "@/Types/api/note";
import type { Task } from "@/Types/api/tasks";
import { dayKeyIn, hasDueTime } from "@/Components/Redesign/agent";
import { dayDiff, taskDueText, wallTime } from "../today/format";
import { NewActivityButton } from "./ContactHeader";
import { buildComingUp, type ComingUpItem } from "./model";

const ROWS = 5;

type CardId = string;

export interface ActivityPermissions {
    viewNotes: boolean;
    viewTasks: boolean;
    viewMeetings: boolean;
    /** What the viewer may create: task, meeting, note, log. */
    create: Partial<Record<LeadCreateKind, boolean>>;
}

/**
 * The record's lists, from whichever workspace context the page holds
 * (LeadWorkspaceContext or DealWorkspaceContext), and the timeline to read.
 */
export interface ActivitySource {
    tasks: Task[];
    tasksLoading: boolean;
    meetings: DealFollowup[];
    meetingsLoading: boolean;
    notes: Note[];
    notesLoading: boolean;
    /** useDealTimeline's record: the deal id (default model) or the lead id with LEAD_TIMELINE_MODEL_TYPE. */
    timelineId: number;
    timelineModelType?: string;
}

interface ActivityCardsProps {
    source: ActivitySource;
    /** "Coming up on this deal" in the deal state. */
    comingUpTitle?: string;
    nowMs: number;
    timeZone: string;
    permissions: ActivityPermissions;
    onCreate: (kind: LeadCreateKind) => void;
    onOpenTask: (id: number) => void;
    onOpenMeeting: (id: number) => void;
    onOpenNote: (id: number) => void;
    /**
     * The deal-only view: no Last touches (the timeline also carries the lead's
     * own events), Notes titled for the deal, and these cards after them.
     */
    dealOnly?: { notesTitle: string; extraCards: Array<{ id: string; label: string; node: ReactNode }> };
}

/** Window event that switches the strip to the card named in `detail` (matters where the cards are tabs). */
export const SHOW_ACTIVITY_CARD = "agent-activity:show";

/**
 * Coming up, Last touches and Notes, side by side; tabs on a phone. Coming
 * up and Notes read the page's workspace context (the record page's own
 * lists); Last touches is the record's CRM-event timeline, its Timeline tab.
 */
export default function ActivityCards(props: ActivityCardsProps) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<CardId>("coming_up");
    const { permissions } = props;

    const cards: Array<{ id: CardId; label: string; node: ReactNode }> = [];
    if (permissions.viewTasks || permissions.viewMeetings) {
        cards.push({
            id: "coming_up",
            label: t("pages.agent_workspace.contact.coming_up.title"),
            node: <ComingUpCard {...props} />,
        });
    }
    if (!props.dealOnly) {
        cards.push({ id: "touches", label: t("pages.agent_workspace.contact.touches.title"), node: <LastTouchesCard {...props} /> });
    }
    if (permissions.viewNotes) {
        cards.push({ id: "notes", label: t("pages.agent_workspace.contact.notes.title"), node: <NotesCard {...props} /> });
    }
    if (props.dealOnly) cards.push(...props.dealOnly.extraCards);
    // Something outside the cards (a button in the AI strip) can ask for one to be shown.
    useEffect(() => {
        const show = (event: Event) => {
            const id = (event as CustomEvent<string>).detail;
            if (typeof id === "string") setTab(id);
        };
        window.addEventListener(SHOW_ACTIVITY_CARD, show);
        return () => window.removeEventListener(SHOW_ACTIVITY_CARD, show);
    }, []);

    // A viewer who may see none of the cards gets no strip at all.
    if (cards.length === 0) return null;
    const active = cards.some((card) => card.id === tab) ? tab : cards[0].id;

    return (
        <div className="agent-activity" data-active={active}>
            <div className="agent-activity__switch">
                <Segmented
                    value={active}
                    onChange={(value) => setTab(value)}
                    options={cards.map((card) => ({ value: card.id, label: card.label }))}
                    ariaLabel={t("pages.agent_workspace.contact.activity_aria")}
                    fullWidth
                />
            </div>
            {cards.map((card) => (
                <div key={card.id} id={`agent-activity-${card.id}`} className="agent-activity__slot" data-card={card.id}>
                    {card.node}
                </div>
            ))}
        </div>
    );
}

function Card({
    title,
    action,
    children,
}: {
    title: ReactNode;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="agent-card">
            <div className="agent-card__head">
                <h2 className="agent-card__title">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

function CardSkeleton() {
    return (
        <div className="agent-card__skeleton" aria-hidden="true">
            <span />
            <span />
        </div>
    );
}

/** Short date for a row: "Today", "Sun 8" within a week either side, "28 Oct" otherwise. */
function shortDay(ms: number, nowMs: number, timeZone: string, locale: string, todayLabel: string): string {
    const days = Math.abs(dayDiff(dayKeyIn(ms, timeZone), dayKeyIn(nowMs, timeZone)));
    if (days === 0) return todayLabel;
    const options: Intl.DateTimeFormatOptions =
        days < 7 ? { weekday: "short", day: "numeric" } : { day: "numeric", month: "short" };
    return new Intl.DateTimeFormat(locale || undefined, { ...options, timeZone: timeZone || undefined }).format(new Date(ms));
}

function ComingUpCard({ source, comingUpTitle, nowMs, timeZone, permissions, onCreate, onOpenTask, onOpenMeeting }: ActivityCardsProps) {
    const { t, locale } = useTranslation();
    const todayLabel = t("pages.agent_workspace.today.title");
    const { td } = useTd();
    const { tasks, meetings, tasksLoading, meetingsLoading } = source;
    const overview = useWorkspaceOverview({ dealFollowUps: meetings });

    const items = useMemo(
        () =>
            buildComingUp(permissions.viewTasks ? tasks : [], permissions.viewMeetings ? overview.meetings : [], nowMs, timeZone),
        [nowMs, overview.meetings, permissions.viewMeetings, permissions.viewTasks, tasks, timeZone],
    );
    const loading = (tasksLoading && tasks.length === 0) || (meetingsLoading && meetings.length === 0);

    const when = (item: ComingUpItem): string => {
        if (item.kind === "meeting") {
            if (item.state === "now") return t("pages.agent_workspace.contact.coming_up.now");
            return item.preview.timeLabel;
        }
        // The row's day column carries the date; this adds how late, the
        // weekday or the time where that helps.
        const today = dayKeyIn(nowMs, timeZone);
        const near = item.due !== null && dayDiff(today, item.due.slice(0, 10)) <= 6;
        if (item.state === "late" || item.state === "none" || near) {
            return taskDueText(item.due, item.state, nowMs, timeZone, locale, t);
        }
        return item.due && hasDueTime(item.due) ? wallTime(item.due) : "";
    };

    return (
        <Card
            title={comingUpTitle ?? t("pages.agent_workspace.contact.coming_up.title")}
            action={<NewActivityButton onCreate={onCreate} allowed={permissions.create} size="sm" />}
        >
            {loading ? (
                <CardSkeleton />
            ) : items.length === 0 ? (
                <EmptyState
                    icon="calendar"
                    title={t("pages.agent_workspace.contact.coming_up.empty")}
                    className="agent-card__empty"
                />
            ) : (
                <ul className="agent-card__list">
                    {items.slice(0, ROWS).map((item) => (
                        <li key={`${item.kind}-${item.id}`} className={`agent-upcoming agent-ts--${item.state}`}>
                            <button
                                type="button"
                                className="agent-upcoming__open"
                                onClick={() => (item.kind === "task" ? onOpenTask(item.id) : onOpenMeeting(item.id))}
                            >
                                <span className="agent-upcoming__day">
                                    {item.at !== null ? shortDay(item.at, nowMs, timeZone, locale, todayLabel) : "—"}
                                </span>
                                <span className="agent-upcoming__body">
                                    <span className="agent-upcoming__title">
                                        {item.kind === "meeting" ? td(item.title, { source: "en" }) : item.title}
                                    </span>
                                    <span className="agent-upcoming__sub">
                                        {[
                                            item.kind === "task"
                                                ? t("pages.agent_workspace.contact.coming_up.task")
                                                : t("pages.agent_workspace.contact.coming_up.meeting"),
                                            when(item),
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </span>
                                </span>
                                {item.state === "late" || item.state === "now" ? (
                                    <span className="agent-upcoming__state">
                                        {item.state === "late"
                                            ? t("pages.agent_workspace.contact.coming_up.overdue")
                                            : t("pages.agent_workspace.contact.coming_up.now")}
                                    </span>
                                ) : null}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {items.length > ROWS ? (
                <p className="agent-card__more">{t("pages.agent_workspace.contact.more_count", { count: items.length - ROWS })}</p>
            ) : null}
        </Card>
    );
}

function LastTouchesCard({ source, nowMs, timeZone, permissions, onCreate }: ActivityCardsProps) {
    const { t, locale } = useTranslation();
    const todayLabel = t("pages.agent_workspace.today.title");
    const { td } = useTd();
    const timeline = useDealTimeline(source.timelineId, source.timelineModelType);
    const events = timeline.events.slice(0, ROWS);

    return (
        <Card
            title={t("pages.agent_workspace.contact.touches.title")}
            action={
                permissions.create.log !== false ? (
                    <Button variant="ghost" size="sm" onClick={() => onCreate("log")}>
                        {t("pages.agent_workspace.contact.log_activity")}
                    </Button>
                ) : null
            }
        >
            {timeline.isLoading ? (
                <CardSkeleton />
            ) : events.length === 0 ? (
                <EmptyState icon="activity" title={t("pages.agent_workspace.contact.touches.empty")} className="agent-card__empty" />
            ) : (
                <ul className="agent-card__list agent-card__list--rows">
                    {events.map((event) => {
                        const at = Date.parse(event.occurredAt);
                        const detail = event.preview || event.grouped || event.meta;
                        return (
                            <li key={event.id} className="agent-row">
                                <span className="agent-row__day">
                                    {Number.isNaN(at) ? "" : shortDay(at, nowMs, timeZone, locale, todayLabel)}
                                </span>
                                <span className="agent-row__body">
                                    <span className="agent-row__title">
                                        {event.titleLocalized ? event.title : td(event.title, { source: "en" })}
                                    </span>
                                    {detail ? <span className="agent-row__sub">{detail}</span> : null}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}

function NotesCard({ source, nowMs, timeZone, permissions, onCreate, onOpenNote, dealOnly }: ActivityCardsProps) {
    const { t, locale } = useTranslation();
    const todayLabel = t("pages.agent_workspace.today.title");
    const { notes, notesLoading } = source;
    const overview = useWorkspaceOverview({ notes });

    return (
        <Card
            title={
                <>
                    {dealOnly?.notesTitle ?? t("pages.agent_workspace.contact.notes.title")}
                    {notes.length > 0 ? <span className="agent-card__count"> · {notes.length}</span> : null}
                </>
            }
            action={
                permissions.create.note !== false ? (
                    <Button size="sm" className="agent-btn-soft" onClick={() => onCreate("note")}>
                        <Icon name="plus" size={12} />
                        {t("pages.agent_workspace.contact.notes.add")}
                    </Button>
                ) : null
            }
        >
            {notesLoading && notes.length === 0 ? (
                <CardSkeleton />
            ) : overview.notes.length === 0 ? (
                <EmptyState icon="file-text" title={t("pages.agent_workspace.contact.notes.empty")} className="agent-card__empty" />
            ) : (
                <ul className="agent-card__list agent-card__list--rows">
                    {overview.notes.slice(0, ROWS).map((note) => (
                        <li key={note.id} className="agent-row">
                            <button type="button" className="agent-row__open" onClick={() => onOpenNote(note.id)}>
                                <span className="agent-row__day">
                                    {note.createdAt ? shortDay(note.createdAt.getTime(), nowMs, timeZone, locale, todayLabel) : ""}
                                </span>
                                <span className="agent-row__body">
                                    <span className="agent-row__title">{note.title || note.preview}</span>
                                    <span className="agent-row__sub">
                                        {note.title ? `${note.preview} · ` : ""}
                                        {note.authorName}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {overview.notes.length > ROWS ? (
                <p className="agent-card__more">{t("pages.agent_workspace.contact.more_count", { count: overview.notes.length - ROWS })}</p>
            ) : null}
        </Card>
    );
}

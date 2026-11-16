import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
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
import { AgentCardControls, AgentCardFilters, AgentCardSearch, dayKeyIn, hasDueTime, matchesCardSearch } from "@/Components/Redesign/agent";
import type { TimelineFilter } from "@/Pages/Deals/Redesign/adapters/timelineAdapter";
import { dayDiff, taskDueText, wallTime } from "../today/format";
import { NewActivityButton } from "./ContactHeader";
import { buildComingUp, type ComingUpItem } from "./model";

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
    /** Opens the brief for an upcoming meeting (the deal state); left out where there is none. */
    onOpenBrief?: (id: number) => void;
    /** A row held at the top of Coming up that is not a task or meeting yet (a pending booking). */
    comingUpPinned?: ReactNode;
    /**
     * The deal-only view: no Last touches (the timeline also carries the lead's
     * own events), Notes titled for the deal, and these cards after them.
     */
    dealOnly?: { notesTitle: string; extraCards: Array<{ id: string; label: string; node: ReactNode }> };
}

/** Window event that switches the strip to the card named in `detail` (matters where the cards are tabs). */
export const SHOW_ACTIVITY_CARD = "agent-activity:show";

/**
 * Coming up, Last touches and Notes, side by side at one height (canvas L8):
 * each card scrolls inside and has its own filters, so a long list never
 * stretches the row. Tabs on a phone. Coming up and Notes read the page's
 * workspace context (the record page's own lists); Last touches is the
 * record's CRM-event timeline, its Timeline tab.
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
    controls,
    children,
}: {
    title: ReactNode;
    action?: ReactNode;
    /** Search and filters, under the title. */
    controls?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="agent-card agent-card--fixed">
            <div className="agent-card__head">
                <h2 className="agent-card__title">{title}</h2>
                {action}
            </div>
            {controls}
            <div className="agent-card__scroll">{children}</div>
        </section>
    );
}

/** A search or filter that leaves nothing to show. */
function NoMatch() {
    const { t } = useTranslation();
    return <p className="agent-card__nomatch">{t("pages.agent_workspace.contact.cards.no_match")}</p>;
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

type ComingUpFilter = "all" | "task" | "meeting";

function ComingUpCard({
    source,
    comingUpTitle,
    nowMs,
    timeZone,
    permissions,
    onCreate,
    onOpenTask,
    onOpenMeeting,
    onOpenBrief,
    comingUpPinned,
}: ActivityCardsProps) {
    const { t, locale } = useTranslation();
    const [filter, setFilter] = useState<ComingUpFilter>("all");
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
    const shown = filter === "all" ? items : items.filter((item) => item.kind === filter);
    // The pinned row is a meeting to be: it stays under All and Meetings.
    const pinned = comingUpPinned && filter !== "task" ? comingUpPinned : null;
    // Filters only help when the card can hold both kinds.
    const filterable = permissions.viewTasks && permissions.viewMeetings && items.length > 0;

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
            controls={
                filterable ? (
                    <AgentCardControls>
                        <AgentCardFilters<ComingUpFilter>
                            value={filter}
                            onChange={setFilter}
                            label={t("pages.agent_workspace.contact.cards.filter_aria")}
                            options={[
                                { value: "all", label: t("pages.agent_workspace.contact.cards.all") },
                                { value: "task", label: t("pages.agent_workspace.contact.cards.tasks") },
                                { value: "meeting", label: t("pages.agent_workspace.contact.cards.meetings") },
                            ]}
                        />
                    </AgentCardControls>
                ) : null
            }
        >
            {loading ? (
                <CardSkeleton />
            ) : items.length === 0 && !comingUpPinned ? (
                // Nothing ahead: shown in amber as needing input (canvas L7-47), since
                // an open lead or deal should always have a next step.
                <div className="agent-card__gap" role="status">
                    <b className="agent-card__gap-title">
                        {t(`pages.agent_workspace.contact.coming_up.${comingUpTitle ? "empty_deal" : "empty_lead"}`)}
                    </b>
                    <span className="agent-card__gap-text">
                        {t(`pages.agent_workspace.contact.coming_up.${comingUpTitle ? "empty_deal_text" : "empty_lead_text"}`)}
                    </span>
                    <NewActivityButton onCreate={onCreate} allowed={permissions.create} size="sm" tone="navy" />
                </div>
            ) : shown.length === 0 && !pinned ? (
                <NoMatch />
            ) : (
                <ul className="agent-card__list">
                    {pinned}
                    {shown.map((item) => (
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
                            {item.kind === "meeting" && onOpenBrief && item.state !== "done" ? (
                                <button type="button" className="agent-upcoming__brief" onClick={() => onOpenBrief(item.id)}>
                                    <Icon name="file-text" size={12} />
                                    {t("pages.agent_workspace.contact.brief.open")}
                                </button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

const TOUCH_FILTERS: TimelineFilter[] = ["all", "agent", "system", "external"];

function LastTouchesCard({ source, nowMs, timeZone, permissions, onCreate }: ActivityCardsProps) {
    const { t, locale } = useTranslation();
    const todayLabel = t("pages.agent_workspace.today.title");
    const { td } = useTd();
    const timeline = useDealTimeline(source.timelineId, source.timelineModelType);
    const { events, filter, setFilter } = timeline;

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
            controls={
                <AgentCardControls>
                    <AgentCardFilters<TimelineFilter>
                        value={filter}
                        onChange={setFilter}
                        label={t("pages.agent_workspace.contact.cards.filter_aria")}
                        options={TOUCH_FILTERS.map((value) => ({ value, label: t(`pages.agent_workspace.deal.history.filter_${value}`) }))}
                    />
                </AgentCardControls>
            }
        >
            {timeline.isLoading && events.length === 0 ? (
                <CardSkeleton />
            ) : events.length === 0 ? (
                filter === "all" ? (
                    <EmptyState icon="activity" title={t("pages.agent_workspace.contact.touches.empty")} className="agent-card__empty" />
                ) : (
                    <NoMatch />
                )
            ) : (
                <>
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
                    {timeline.hasNextPage ? (
                        <Button variant="ghost" size="sm" className="agent-card__load" loading={timeline.isFetchingNextPage} onClick={() => void timeline.fetchNextPage()}>
                            {t("pages.agent_workspace.contact.cards.load_more")}
                        </Button>
                    ) : null}
                </>
            )}
        </Card>
    );
}

type NotesFilter = "all" | "mine";

function NotesCard({ source, nowMs, timeZone, permissions, onCreate, onOpenNote, dealOnly }: ActivityCardsProps) {
    const { t, locale } = useTranslation();
    const todayLabel = t("pages.agent_workspace.today.title");
    const viewerId = usePage<PageProps>().props.auth?.user?.id;
    const { notes, notesLoading } = source;
    const overview = useWorkspaceOverview({ notes });
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<NotesFilter>("all");
    const authorOf = useMemo(() => new Map(notes.map((note) => [note.id, note.added_by?.id ?? null])), [notes]);
    const shown = overview.notes.filter(
        (note) =>
            (filter === "all" || authorOf.get(note.id) === viewerId) &&
            matchesCardSearch(query, note.title, note.body, note.authorName),
    );

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
            controls={
                overview.notes.length > 0 ? (
                    <AgentCardControls>
                        <AgentCardSearch value={query} onChange={setQuery} placeholder={t("pages.agent_workspace.contact.cards.search_notes")} />
                        <AgentCardFilters<NotesFilter>
                            value={filter}
                            onChange={setFilter}
                            label={t("pages.agent_workspace.contact.cards.filter_aria")}
                            options={[
                                { value: "all", label: t("pages.agent_workspace.contact.cards.all") },
                                { value: "mine", label: t("pages.agent_workspace.contact.cards.mine") },
                            ]}
                        />
                    </AgentCardControls>
                ) : null
            }
        >
            {notesLoading && notes.length === 0 ? (
                <CardSkeleton />
            ) : overview.notes.length === 0 ? (
                <EmptyState icon="file-text" title={t("pages.agent_workspace.contact.notes.empty")} className="agent-card__empty" />
            ) : shown.length === 0 ? (
                <NoMatch />
            ) : (
                <ul className="agent-card__list agent-card__list--rows">
                    {shown.map((note) => (
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
        </Card>
    );
}

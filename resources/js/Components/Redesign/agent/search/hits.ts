import dayjs from "dayjs";
import timezonePlugin from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { companyTimeDayjsFormat } from "@/lib/companyDateTime";
import { hasDueTime } from "../timeState";
import type { DealHit, MeetingHit, NoteHit, PersonHit, PropertyHit, SearchGroup, SearchResults, TaskHit } from "./types";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface HitContext {
    t: Translate;
    locale: string;
    timeZone: string;
    nowMs: number;
    userId: number | null;
}

interface HitBase {
    key: string;
    group: SearchGroup;
    /** The record's name, which carries the highlight. */
    title: string;
    /** The grey line under it. */
    meta: string;
    /** Where Enter or Open goes. */
    href: string;
}

export type Hit =
    | (HitBase & { kind: "person"; person: PersonHit; initials: string })
    | (HitBase & { kind: "deal"; deal: DealHit })
    | (HitBase & { kind: "property"; property: PropertyHit })
    | (HitBase & { kind: "task"; task: TaskHit })
    | (HitBase & { kind: "meeting"; meeting: MeetingHit })
    | (HitBase & { kind: "note"; note: NoteHit });

const intl = (locale: string) => (locale === "en" || locale === "eng" ? "en-GB" : locale);

export function initialsOf(name: string | null): string {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

const SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", TRY: "₺" };

/** A price, with the currency as its symbol ("€ 178,000"); a property carries its currency as a code. */
function money(value: number | null, currency: string | null, locale: string): string {
    if (value === null) return "";
    const symbol = currency ? (SYMBOLS[currency.toUpperCase()] ?? currency) : null;
    const amount = new Intl.NumberFormat(intl(locale), { maximumFractionDigits: 0 }).format(value);
    return symbol ? `${symbol} ${amount}` : amount;
}

/** "Today 14:00", "Tomorrow", "Tue 10 Nov 14:00": a day (and time, when it has one) from now. */
function whenText(value: string | null, wallClock: boolean, ctx: HitContext): string {
    if (!value) return "";
    const moment = wallClock ? dayjs(value.slice(0, 19)) : ctx.timeZone ? dayjs(value).tz(ctx.timeZone) : dayjs(value);
    const today = (ctx.timeZone ? dayjs(ctx.nowMs).tz(ctx.timeZone) : dayjs(ctx.nowMs)).startOf("day");
    const days = moment.startOf("day").diff(today, "day");
    const timed = wallClock ? hasDueTime(value) : true;
    const time = timed ? moment.format(companyTimeDayjsFormat()) : "";
    const day =
        days === 0
            ? ctx.t("pages.agent_workspace.search_results.row.today")
            : days === 1
              ? ctx.t("pages.agent_workspace.search_results.row.tomorrow")
              : new Intl.DateTimeFormat(intl(ctx.locale), { weekday: "short", day: "numeric", month: "short" }).format(moment.toDate());
    return `${day}${time ? ` ${time}` : ""}`.trim();
}

function shortDate(value: string | null, ctx: HitContext): string {
    if (!value) return "";
    return new Intl.DateTimeFormat(intl(ctx.locale), { day: "numeric", month: "short" }).format(ctx.timeZone ? dayjs(value).tz(ctx.timeZone).toDate() : new Date(value));
}

const dot = " · ";
const join = (parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(dot);

/** Opening a lead or a deal: the person's page, in the deal's state when there is one. */
function recordHref(leadId: number | null, dealId: number | null): string {
    if (leadId && dealId) return route("agent.people.deal", { lead: leadId, deal: dealId });
    if (dealId) return route("agent.deals.show", dealId);
    if (leadId) return route("agent.people.show", leadId);
    return route("agent.tasks");
}

function personHit(person: PersonHit, ctx: HitContext, withPhone: boolean): Hit {
    const row = (key: string, params?: Record<string, string | number>) => ctx.t(`pages.agent_workspace.search_results.row.${key}`, params);
    const owner = person.owner_id !== null && person.owner_id === ctx.userId ? row("owner_you") : person.owner_name ? row("owner_name", { name: person.owner_name }) : null;
    return {
        kind: "person",
        key: `people-${person.id}`,
        group: "people",
        title: person.name ?? "",
        initials: initialsOf(person.name),
        person,
        href: route("agent.people.show", person.id),
        meta: join([row("lead"), person.status ?? row("no_status"), person.deals > 0 ? row(person.deals === 1 ? "deals_one" : "deals_other", { count: person.deals }) : null, owner, withPhone ? person.phone : null]),
    };
}

function dealHit(deal: DealHit, ctx: HitContext): Hit {
    const row = (key: string, params?: Record<string, string | number>) => ctx.t(`pages.agent_workspace.search_results.row.${key}`, params);
    return {
        kind: "deal",
        key: `deals-${deal.id}`,
        group: "deals",
        title: deal.name ?? deal.person ?? `#${deal.id}`,
        deal,
        href: recordHref(deal.lead_id, deal.id),
        meta: join([
            deal.pipeline,
            deal.stage,
            money(deal.value, deal.currency, ctx.locale),
            deal.read_only && deal.agent_name ? row("agent_name", { name: deal.agent_name }) : null,
            deal.read_only ? row("read_only") : null,
            deal.next_meeting_at ? row("meeting_on", { when: whenText(deal.next_meeting_at, false, ctx) }) : null,
        ]),
    };
}

function propertyHit(property: PropertyHit, ctx: HitContext): Hit {
    const place = join([property.city, property.area && property.area !== property.city ? property.area : null]);
    return {
        kind: "property",
        key: `properties-${property.id}`,
        group: "properties",
        title: property.title,
        property,
        href: route("agent.portfolio.browse", { search: property.title }),
        meta: join([
            place || property.developer,
            property.size_sqm !== null ? `${new Intl.NumberFormat(intl(ctx.locale), { maximumFractionDigits: 0 }).format(property.size_sqm)} m²` : null,
            money(property.price, property.currency, ctx.locale),
            property.construction_status ? property.construction_status.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase()) : null,
        ]),
    };
}

function taskHit(task: TaskHit, ctx: HitContext): Hit {
    const related = task.related;
    return {
        kind: "task",
        key: `tasks-${task.id}`,
        group: "tasks",
        title: task.heading,
        task,
        href: recordHref(related?.type === "lead" ? related.id : null, related?.type === "deal" ? related.id : null),
        meta: join([
            task.due_date ? ctx.t("pages.agent_workspace.search_results.row.due_on", { when: whenText(task.due_date, true, ctx) }) : null,
            related?.person && related.person !== related.name ? related.person : null,
            related?.name,
        ]),
    };
}

function meetingHit(meeting: MeetingHit, ctx: HitContext): Hit {
    const start = meeting.at ? whenText(meeting.at, false, ctx) : "";
    const end = meeting.at && meeting.duration ? (ctx.timeZone ? dayjs(meeting.at).tz(ctx.timeZone) : dayjs(meeting.at)).add(meeting.duration, "minute").format(companyTimeDayjsFormat()) : "";
    return {
        kind: "meeting",
        key: `meetings-${meeting.id}`,
        group: "meetings",
        title: meeting.person && meeting.type ? `${meeting.type} · ${meeting.person}` : meeting.title,
        meeting,
        href: recordHref(meeting.lead_id, meeting.deal_id),
        meta: join([end ? `${start}–${end}` : start, meeting.where]),
    };
}

function noteHit(note: NoteHit, ctx: HitContext): Hit {
    const row = (key: string) => ctx.t(`pages.agent_workspace.search_results.row.${key}`);
    return {
        kind: "note",
        key: `notes-${note.kind}-${note.id}`,
        group: "notes",
        title: note.subject ?? "",
        note,
        href: recordHref(note.lead_id, note.deal_id),
        meta: join([`“${note.snippet}”`, row("mine"), shortDate(note.at, ctx)]),
    };
}

/** Every row of a result, in the order the groups appear (people, deals, properties, tasks, meetings, notes). */
export function buildHits(results: SearchResults | null, ctx: HitContext, variant: "menu" | "page"): Hit[] {
    if (!results) return [];
    const { groups } = results;
    return [
        ...groups.people.map((person) => personHit(person, ctx, variant === "menu")),
        ...groups.deals.map((deal) => dealHit(deal, ctx)),
        ...groups.properties.map((property) => propertyHit(property, ctx)),
        ...groups.tasks.map((task) => taskHit(task, ctx)),
        ...groups.meetings.map((meeting) => meetingHit(meeting, ctx)),
        ...groups.notes.map((note) => noteHit(note, ctx)),
    ];
}

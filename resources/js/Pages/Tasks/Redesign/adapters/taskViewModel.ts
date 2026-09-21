import { formatTaskCompanyTime, parseTaskDateTime } from "@/lib/taskDateTime";
import {
    formatDate,
    formatDateWithTime,
} from "@/Components/Redesign/adapters/dateFormat";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import type { Task } from "@/Types/Task";
import {
    RECORD_TYPES,
    categoryToken,
    priorityToken,
    statusToken,
    type CategoryToken,
    type PriorityToken,
    type RecordTypeKey,
    type StatusToken,
    type TaskBucketKey,
} from "../config/taskDesignTokens";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

export interface LinkedRecord {
    type: RecordTypeKey;
    typeLabel: string;
    name: string;
    d: string;
    iconBg: string;
    iconFg: string;
    href?: string;
}

export interface TaskPerson {
    id: number;
    name: string;
    initials: string;
    /** Profile photo URL when the user has one. */
    image?: string | null;
}

export interface TaskViewModel {
    id: number;
    task: Task;
    title: string;
    /** First sentence of the description — the board card's blurb. */
    blurb: string;
    descriptionText: string;
    done: boolean;
    bucket: TaskBucketKey;
    statusSlug: string;
    status: StatusToken;
    priority: PriorityToken;
    /** Null when the task has no category — nothing should render for it. */
    category: CategoryToken | null;
    /** e.g. "Today · 17:00", or "No date". */
    dueText: string;
    /** e.g. "Due in 3 hrs" / "Overdue by 2 days" / "No due date". */
    dueSub: string;
    dueColor: string;
    dueBg: string;
    dueBorder: string;
    people: TaskPerson[];
    peopleLabel: string;
    /** Full linked-record list, unlike `links` below which caps at 2 for compact cards. */
    allLinks: LinkedRecord[];
    links: LinkedRecord[];
    extraLinks: number;
    titleColor: string;
    titleDecoration: string;
    checkBorder: string;
    checkBg: string;
}

const MS_PER_DAY = 86_400_000;

function startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
}

export function isTaskDone(task: Task, completedSlugs: string[]): boolean {
    const slug = task.board_column?.slug ?? task.status ?? "to_do";
    return completedSlugs.includes(slug) || Boolean(task.completed_on);
}

export function bucketOf(
    task: Task,
    done: boolean,
    now: Date = new Date(),
): TaskBucketKey {
    if (done) return "done";
    const due = parseTaskDateTime(task.due_date);
    if (!due) return "unscheduled";

    const today = startOfDay(now).getTime();
    const dueDay = startOfDay(due).getTime();
    if (dueDay < today) return "overdue";
    if (dueDay === today) return "today";
    return "upcoming";
}

/**
 * Relative sub-label under the due date, matching the template's phrasing
 * ("Due in 3 hrs", "Overdue by 2 days", "Due tomorrow", "Completed").
 * Returns English source strings — the render site wraps them in `td()`.
 */
function dueSubLabel(
    due: Date | null,
    bucket: TaskBucketKey,
    now: Date,
): string {
    if (bucket === "done") return "Completed";
    if (!due) return "No due date";

    const diffMs = due.getTime() - now.getTime();
    const dayDiff = Math.round(
        (startOfDay(due).getTime() - startOfDay(now).getTime()) / MS_PER_DAY,
    );

    if (bucket === "overdue") {
        const hoursLate = Math.floor(-diffMs / 3_600_000);
        if (dayDiff === 0) {
            return `Overdue by ${hoursLate} ${hoursLate === 1 ? "hr" : "hrs"}`;
        }
        const daysLate = -dayDiff;
        return `Overdue by ${daysLate} ${daysLate === 1 ? "day" : "days"}`;
    }

    if (bucket === "today") {
        const hoursLeft = Math.max(0, Math.floor(diffMs / 3_600_000));
        return hoursLeft <= 0
            ? "Due today"
            : `Due in ${hoursLeft} ${hoursLeft === 1 ? "hr" : "hrs"}`;
    }

    if (dayDiff === 1) return "Due tomorrow";
    return `Due in ${dayDiff} days`;
}

/** "Today · 17:00" / "Yesterday · 11:00" / "22 Aug · 12:00" / "No date". */
function dueDisplay(due: Date | null, now: Date): string {
    if (!due) return "No date";

    const dayDiff = Math.round(
        (startOfDay(due).getTime() - startOfDay(now).getTime()) / MS_PER_DAY,
    );
    // Was slicing the last space-separated token off the combined date+time
    // string to get "the time" — worked for 24h formats ("17:00", no
    // internal space) but for a 12h company format ("5:00 PM") that token
    // is just "PM", silently dropping the actual time.
    const time = formatTaskCompanyTime(due, "");

    if (dayDiff === 0) return time ? `Today · ${time}` : "Today";
    if (dayDiff === -1) return time ? `Yesterday · ${time}` : "Yesterday";
    if (dayDiff === 1) return time ? `Tomorrow · ${time}` : "Tomorrow";
    return formatDateWithTime(due);
}

export function linkedRecordsOf(task: Task): LinkedRecord[] {
    const records: LinkedRecord[] = [];

    (task.deals ?? []).forEach((deal) =>
        records.push({
            type: "deal",
            typeLabel: RECORD_TYPES.deal.label,
            name: deal.name,
            d: RECORD_TYPES.deal.d,
            iconBg: RECORD_TYPES.deal.iconBg,
            iconFg: RECORD_TYPES.deal.iconFg,
            href: route("deals.show", deal.id),
        }),
    );

    (task.leads ?? []).forEach((lead) =>
        records.push({
            type: "lead",
            typeLabel: RECORD_TYPES.lead.label,
            name: lead.client_name || lead.company_name || "Lead",
            d: RECORD_TYPES.lead.d,
            iconBg: RECORD_TYPES.lead.iconBg,
            iconFg: RECORD_TYPES.lead.iconFg,
            href: route("lead-contact.show", lead.id),
        }),
    );

    (task.properties ?? []).forEach((property) =>
        records.push({
            type: "property",
            typeLabel: RECORD_TYPES.property.label,
            name: property.name ?? "Property",
            d: RECORD_TYPES.property.d,
            iconBg: RECORD_TYPES.property.iconBg,
            iconFg: RECORD_TYPES.property.iconFg,
        }),
    );

    (task.developer_projects ?? []).forEach((project) =>
        records.push({
            type: "project",
            typeLabel: RECORD_TYPES.project.label,
            name: project.name,
            d: RECORD_TYPES.project.d,
            iconBg: RECORD_TYPES.project.iconBg,
            iconFg: RECORD_TYPES.project.iconFg,
            href: route("developer-projects.show", project.id),
        }),
    );

    return records;
}

/**
 * Decorates a task with every presentational value the list rows, board
 * cards and detail modal read — the direct analogue of the template's
 * `decorate(t)`.
 */
export function toTaskViewModel(
    task: Task,
    completedSlugs: string[],
    now: Date = new Date(),
): TaskViewModel {
    const done = isTaskDone(task, completedSlugs);
    const bucket = bucketOf(task, done, now);
    const due = parseTaskDateTime(task.due_date);
    const slug = task.board_column?.slug ?? task.status ?? "to_do";

    const late = bucket === "overdue";
    const today = bucket === "today";

    const allLinks = linkedRecordsOf(task);
    const people: TaskPerson[] = (task.users ?? []).map((user) => ({
        id: user.id,
        name: user.name?.trim() || "Unknown",
        initials: initialsFromName(user.name),
        image: user.image ?? null,
    }));

    const description = stripHtml(task.description ?? "");
    const firstSentence = description.split(/(?<=\.)\s/)[0] ?? description;

    return {
        id: task.id,
        task,
        title: task.heading?.trim() || "Untitled task",
        blurb: firstSentence,
        descriptionText: description,
        done,
        bucket,
        statusSlug: slug,
        status: statusToken(slug),
        priority: priorityToken(task.priority),
        category: categoryToken(task.category?.category_name),
        dueText: dueDisplay(due, now),
        dueSub: dueSubLabel(due, bucket, now),
        dueColor: done
            ? T.TEXT_HINT
            : late
              ? T.RED
              : today
                ? T.AMBER_TEXT
                : T.TEXT_MUTED,
        dueBg: late ? T.RED_SOFT : today ? T.AMBER_BG : T.GRAY,
        dueBorder: late ? T.RED_MID : today ? T.AMBER_BORDER : T.GRAY_MID,
        people,
        peopleLabel:
            people.length === 0
                ? "Unassigned"
                : people.length > 1
                  ? `${people[0].name} +${people.length - 1}`
                  : people[0].name,
        allLinks,
        links: allLinks.slice(0, 2),
        extraLinks: Math.max(0, allLinks.length - 2),
        titleColor: done ? T.TEXT_HINT : T.TEXT,
        titleDecoration: done ? "line-through" : "none",
        checkBorder: done ? T.GREEN : T.NAVY_MID,
        checkBg: done ? T.GREEN : T.WHITE,
    };
}

export { formatDate };

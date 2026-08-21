import type { TaskPriorityKey, RecordTypeKey } from "../config/taskDesignTokens";
import type { TaskViewModel } from "./taskViewModel";

export interface TaskLinkRef {
    type: RecordTypeKey;
    id: number;
    name: string;
}

export interface TaskFormValues {
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: TaskPriorityKey;
    assignees: number[];
    categoryId: number | null;
    boardColumnId: number | null;
    links: TaskLinkRef[];
    /** New checklist rows to create against the saved task. */
    checklist: string[];
    /** New files to upload once the task exists. */
    files: File[];
}

export interface RecordPoolItem {
    id: number;
    name: string;
    meta?: string;
}

export interface RecordPool {
    deal: RecordPoolItem[];
    lead: RecordPoolItem[];
    property: RecordPoolItem[];
    project: RecordPoolItem[];
}

const DEFAULT_DUE_TIME = "17:00";

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

export function emptyTaskForm(): TaskFormValues {
    return {
        title: "",
        description: "",
        startDate: todayIso(),
        dueDate: "",
        dueTime: DEFAULT_DUE_TIME,
        priority: "medium",
        assignees: [],
        categoryId: null,
        boardColumnId: null,
        links: [],
        checklist: [],
        files: [],
    };
}

/** The task's existing links, in the shape the form modal edits. */
export function taskLinkRefs(vm: TaskViewModel): TaskLinkRef[] {
    const task = vm.task;
    return [
        ...(task.deals ?? []).map((deal) => ({
            type: "deal" as const,
            id: deal.id,
            name: deal.name,
        })),
        ...(task.leads ?? []).map((lead) => ({
            type: "lead" as const,
            id: lead.id,
            name: lead.client_name || lead.company_name || "Lead",
        })),
        ...(task.properties ?? []).map((property) => ({
            type: "property" as const,
            id: property.id,
            name: property.name ?? "Property",
        })),
        // "project" here means developer project (the one holding units),
        // matching syncTaskLinks() on the backend — not task.project, which
        // is the unrelated Worksuite delivery project.
        ...(task.developer_projects ?? []).map((project) => ({
            type: "project" as const,
            id: project.id,
            name: project.name,
        })),
    ];
}

/** Form defaults shared by the edit and duplicate modals. */
export function taskFormInitialFromVm(
    vm: TaskViewModel,
): Partial<TaskFormValues> {
    return {
        title: vm.task.heading,
        description: vm.descriptionText,
        startDate: vm.task.start_date?.slice(0, 10) ?? "",
        dueDate: vm.task.due_date?.slice(0, 10) ?? "",
        dueTime: vm.task.due_date?.slice(11, 16) || DEFAULT_DUE_TIME,
        priority: vm.task.priority as TaskPriorityKey,
        assignees: vm.people.map((person) => person.id),
        categoryId: vm.task.category?.id ?? null,
        boardColumnId: vm.task.board_column_id ?? null,
        links: taskLinkRefs(vm),
    };
}

/**
 * Duplicate-modal defaults: everything `taskFormInitialFromVm` carries over
 * (assignees, linked records), plus the source task's checklist titles —
 * unlike edit mode, where the form's checklist field only ever adds new
 * rows, duplicating should recreate the whole checklist on the new task.
 */
export function taskDuplicateInitialFromVm(
    vm: TaskViewModel,
): Partial<TaskFormValues> {
    return {
        ...taskFormInitialFromVm(vm),
        checklist: (vm.task.subtasks ?? []).map((item) => item.title),
    };
}

export function toRecordPool(input: {
    deals: Array<{ id: number; name: string }>;
    leads: Array<{
        id: number;
        client_name: string;
        company_name?: string;
    }>;
    properties: Array<{ id: number; name?: string; title?: string }>;
    developerProjects: Array<{ id: number; name: string }>;
}): RecordPool {
    return {
        deal: input.deals.map((deal) => ({ id: deal.id, name: deal.name })),
        lead: input.leads.map((lead) => ({
            id: lead.id,
            name: lead.client_name || lead.company_name || "Lead",
            meta: lead.company_name ?? undefined,
        })),
        property: input.properties.map((property) => ({
            id: property.id,
            name: property.name ?? property.title ?? "Property",
        })),
        project: input.developerProjects.map((project) => ({
            id: project.id,
            name: project.name,
        })),
    };
}

export function formLinksPayload(values: TaskFormValues) {
    return values.links.map((link) => ({
        type: link.type,
        id: link.id,
    }));
}

import {
    asArray,
    type BulkUpdateFieldDef,
    type BulkUpdateValue,
} from "@/Features/BulkActions/bulkUpdateFields";
import type { PipelineStage } from "@/Types/api/deals";
import type { User } from "@/Types";

interface LeadAgent {
    id: number;
    user_id?: number;
    name: string;
    image?: string;
    user?: Pick<User, "id" | "name" | "email" | "image_url">;
}

export interface DealBulkUpdateOptionsInput {
    stages?: PipelineStage[];
    leadAgents?: LeadAgent[];
    employees?: Array<{ id: number; name: string }>;
    /** Stages belong to a pipeline; only offer the ones in view. */
    activePipelineId?: number | "all";
}

const ids = (value: BulkUpdateValue) => asArray(value).map(Number).filter(Boolean);

/**
 * Deal fields available in the Bulk update workbench.
 *
 * Watchers are add/remove rather than a single "set" list: a bulk replace would
 * silently drop watchers the operator never saw.
 */
export function createDealBulkUpdateFields(
    props: DealBulkUpdateOptionsInput,
): BulkUpdateFieldDef[] {
    const stages = (props.stages ?? [])
        .filter(
            (stage) =>
                props.activePipelineId == null ||
                props.activePipelineId === "all" ||
                Number(stage.lead_pipeline_id) === Number(props.activePipelineId),
        )
        .map((stage) => ({ value: stage.id, label: stage.name }));

    // One entry per user — the same person can hold several agent records.
    const seenUserIds = new Set<number>();
    const agents = (props.leadAgents ?? [])
        .filter((agent) => {
            const userId = agent.user?.id ?? agent.user_id;
            if (!userId || seenUserIds.has(userId)) return false;
            seenUserIds.add(userId);
            return true;
        })
        .map((agent) => ({
            value: agent.id,
            label: agent.user?.name || agent.name,
        }));

    const employees = (props.employees ?? []).map((employee) => ({
        value: employee.id,
        label: employee.name,
    }));

    return [
        {
            key: "pipeline_stage_id",
            label: "Stage",
            section: "Pipeline",
            control: "pills-single",
            clearable: false,
            options: stages,
            // `status` / `agent` are the keys the deals endpoint already reads
            // for its single-field actions.
            toPayload: (value) => ({
                status: value == null || value === "" ? null : Number(value),
            }),
        },
        {
            key: "agent_id",
            label: "Agent",
            section: "Assignment",
            control: "checklist-single",
            clearable: false,
            options: agents,
            toPayload: (value) => ({
                agent: value == null || value === "" ? null : Number(value),
            }),
        },
        {
            key: "watchers_add",
            label: "Add watchers",
            section: "Assignment",
            control: "checklist",
            clearable: false,
            hint: "Keeps existing watchers",
            options: employees,
            toPayload: (value) => ({ watchers_add: ids(value) }),
        },
        {
            key: "watchers_remove",
            label: "Remove watchers",
            section: "Assignment",
            control: "checklist",
            clearable: false,
            hint: "Only affects the people you pick",
            options: employees,
            toPayload: (value) => ({ watchers_remove: ids(value) }),
        },
    ];
}

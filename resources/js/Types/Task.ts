import type { IntegrationOrigin } from "./api/note";

export interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    status: "to_do" | "in_progress" | "in_review" | "on_hold" | "done" | string;
    integration_origin?: IntegrationOrigin | null;
    board_column_id?: number;
    completed_on?: string;
    project?: {
        id: number;
        project_name: string;
        project_short_code?: string;
        client_id?: number;
    };
    category?: {
        id: number;
        category_name: string;
    };
    users?: Array<{
        id: number;
        name: string;
        image?: string;
        designation_name?: string;
    }>;
    labels?: Array<{
        id: number;
        label_name: string;
        label_color: string;
    }>;
    files_count?: number;
    notes_count?: number;
    comments_count?: number;
    subtasks_count?: number;
    completed_subtasks_count?: number;
    created_at: string;
    updated_at: string;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    added_by?: number;
    assigner?: {
        id: number;
        name: string;
        image?: string;
    };
    task_short_code?: string;
    board_column?: {
        id: number;
        column_name: string;
        slug: string;
        label_color: string;
    };
    time_logs?: Array<{
        total_minutes: number;
    }>;
    created_by?: {
        id: number;
        name: string;
        image?: string;
    };
    hash?: string;
    deals?: Array<{
        id: number;
        name: string;
    }>;
    leads?: Array<{
        id: number;
        client_name: string;
        company_name?: string;
    }>;
    properties?: Array<{
        id: number;
        name: string;
    }>;
    approval_send?: number;
}

export interface TaskPayload {
    heading: string;
    description?: string;
    start_date?: string;
    due_date?: string;
    priority?: "low" | "medium" | "high" | "highest" | "urgent";
    project_id?: number;
    user_ids?: number[];
    category_id?: number;
    task_labels?: number[];
    estimate_hours?: number;
    estimate_minutes?: number;
    board_column_id?: number;
    is_private?: boolean;
    billable?: boolean;
    without_duedate?: boolean;
    deal_id?: number;
    lead_id?: number;
    property_id?: number;
    dependent_task_id?: number | null;
    milestone_id?: number;
    repeat?: boolean;
    taskable_type?: string;
    taskable_id?: number;
    custom_fields_data?: Record<string, any>;
    duplicate_source_id?: number;
    select_value?: string; // For 'Waiting Approval' logic
}

export interface TaskStatusPayload {
    taskId: number;
    status: string;
    board_column_id?: number; // Optional if we just send status slug
}

export interface TaskBulkActionPayload {
    action: "delete" | "status" | "change_status"; // mapped to controller logic
    ids: number[];
    status?: string; // for change_status
}

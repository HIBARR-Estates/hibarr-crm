import type { IntegrationOrigin } from "./note";

export interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high";
    status: string;
    integration_origin?: IntegrationOrigin | null;
    board_column_id?: number;
    project?: {
        id: number;
        project_name: string;
        project_short_code?: string;
    };
    category?: {
        id: number;
        category_name: string;
    };
    users?: Array<{
        id: number;
        name: string;
        image?: string;
    }>;
    labels?: Array<{
        id: number;
        label_name: string;
        label_color: string;
    }>;
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
        title?: string;
    }>;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    without_duedate?: boolean;
    boardColumn?: {
        id: number;
        column_name: string;
        label_color: string;
    };

    completed_on?: string;

    files_count?: number;
    notes_count?: number;
    comments_count?: number;
    subtasks_count?: number;
    completed_subtasks_count?: number;
    created_at: string;
    updated_at: string;
    added_by?: number;
}

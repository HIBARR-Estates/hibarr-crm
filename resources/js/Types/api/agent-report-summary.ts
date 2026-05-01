export interface AgentReportSummary {
    id: number;
    title: string | null;
    description: string | null;
    summary: string;
    filter_start_date: string;
    filter_end_date: string;
    filter_agent_id: number | null;
    filter_view_type: "agent" | "department";
    context_label: string;
    created_at: string;
    updated_at: string;
    added_by?: {
        id: number;
        name: string;
        image?: string | null;
    } | null;
    agent?: {
        id: number;
        user?: {
            id: number;
            name: string;
        } | null;
    } | null;
}

import { User, Role } from "..";
import { LeadCategory } from "./leads";

export interface Agent {
    id: number;
    user_id: number;
    company_id: number;
    lead_category_id: number | null;
    parent_agent_id: number | null;
    status: "enabled" | "disabled";
    added_by: number | null;
    last_updated_by: number | null;
    created_at: string;
    updated_at: string;
    deals_count?: number;
    user?: Pick<User, "id" | "name" | "email" | "image_url"> & {
        mobile_with_phone_code?: string;
    };
    category?: LeadCategory | null;
}

export interface PaginatedAgentResponse {
    data: Agent[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface AgentIndexProps {
    pageTitle: string;
    agents: PaginatedAgentResponse;
    categories: LeadCategory[];
    roles: Role[];
    filters: {
        search?: string;
        status?: string;
        category_id?: string;
        start_date?: string;
        end_date?: string;
    };
    permissions: {
        add_lead_agent: string;
        edit_lead_agent: string;
        delete_lead_agent: string;
        view_lead_agents: string;
    };
}

export interface AgentShowProps {
    pageTitle: string;
    agent: Agent;
    agentCategories: LeadCategory[];
    deals: any[];
    permissions: {
        edit_lead_agent: string;
        delete_lead_agent: string;
        view_deals: string;
    };
}

export interface AgentCreateProps {
    pageTitle: string;
    employees: Pick<User, "id" | "name" | "email" | "image_url">[];
    categories: LeadCategory[];
}

export interface AgentEditProps {
    pageTitle: string;
    agent: Agent;
    categories: LeadCategory[];
    currentCategoryIds: number[];
}

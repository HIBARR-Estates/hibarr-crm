import { useApiMutate } from "@/lib/api/client";
import { Deal } from "@/Types/api/deals";
import { ApiResponse } from "./types";

export interface ChangeAgentPayload {
    deal_id: number;
    agent_id: number | null;
}

export interface ChangeAgentResponse {
    deal: Deal;
}

// API functions for deals
export const dealApi = {
    // Change Deal Agent Mutation
    useChangeAgent: () =>
        useApiMutate<
            ChangeAgentPayload,
            ChangeAgentResponse,
            ApiResponse<ChangeAgentResponse>
        >(route("deals.change_agent"), "POST"),
};

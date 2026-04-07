/**
 * useAgentInvitation Hook
 *
 * React Query wrapper around AgentInvitationService for easy component consumption.
 * Auto-reads the authenticated user's LeadAgent ID for filtering invitations.
 */

import { useState } from "react";
import { usePage } from "@inertiajs/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import axios from "axios";
import { getAgentInvitationService } from "@/Services/AgentInvitationService";
import type {
    IGetInvitationsParams,
    IGetInvitationsResponse,
    ICreateInvitationResponse,
    IInvitation,
    IAgentInvitationConfig,
} from "@/Types/invitations";
import { InvitationApiError } from "@/Types/invitations";

// ============================================================================
// Query Keys
// ============================================================================

const INVITATION_QUERY_KEY = "agent-invitations";

// ============================================================================
// Error Extraction Helper
// ============================================================================

const DEFAULT_INVITATION_ERROR = "Failed to send invitation. Please try again.";

/**
 * Extract a user-friendly error message from the invitation API error chain.
 * Checks axios response data (`{ message }`) on the original error, then falls
 * back to the error's own message, and finally to a generic default.
 */
function extractInvitationErrorMessage(error: unknown): string {
    // Unwrap InvitationApiError → originalError (the axios error)
    const axiosError =
        error instanceof InvitationApiError && error.originalError
            ? error.originalError
            : error;

    // Axios attaches the response payload on error.response.data
    if (axios.isAxiosError(axiosError)) {
        const serverMessage = axiosError.response?.data?.message;
        if (typeof serverMessage === "string" && serverMessage.length > 0) {
            return serverMessage;
        }
    }

    // Fallback: use the top-level error message (strip retry wrapper noise)
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return DEFAULT_INVITATION_ERROR;
}

// ============================================================================
// Hook Options
// ============================================================================

export interface UseAgentInvitationOptions {
    /** Override default page size (default: 10) */
    pageSize?: number;
    /** Optional service config overrides */
    configOverrides?: Partial<IAgentInvitationConfig>;
    /** Callback on successful invitation creation */
    onCreateSuccess?: (response: ICreateInvitationResponse) => void;
    /** Callback on invitation creation error */
    onCreateError?: (error: Error) => void;
}

// ============================================================================
// Hook
// ============================================================================

export const useAgentInvitation = (options: UseAgentInvitationOptions = {}) => {
    const { message } = App.useApp();
    const {
        pageSize = 10,
        configOverrides,
        onCreateSuccess,
        onCreateError,
    } = options;

    const { props } = usePage<any>();
    const leadAgentId: number | null | undefined =
        props.auth?.user?.lead_agent_id;

    const queryClient = useQueryClient();
    const service = getAgentInvitationService(configOverrides);

    const [page, setPage] = useState(1);

    // ========================================================================
    // Fetch Invitations
    // ========================================================================

    const queryParams: IGetInvitationsParams = {
        page,
        limit: pageSize,
        ...(leadAgentId ? { crmParentAgentId: String(leadAgentId) } : {}),
    };

    const {
        data: invitationsData,
        isLoading,
        error: fetchError,
        refetch,
    } = useQuery<IGetInvitationsResponse, Error>({
        queryKey: [INVITATION_QUERY_KEY, queryParams],
        queryFn: () => service.getInvitations(queryParams),
        enabled: !!leadAgentId,
    });

    const invitations: IInvitation[] = invitationsData?.data?.result ?? [];
    const totalCount = invitationsData?.data?.totalCount ?? 0;
    const totalPages = invitationsData?.data?.totalPages ?? 1;

    // ========================================================================
    // Create Invitation
    // ========================================================================

    const {
        mutate: sendInvitationMutate,
        isPending: isSending,
        error: createError,
    } = useMutation<ICreateInvitationResponse, Error, string>({
        mutationFn: (agentEmail: string) => {
            if (!leadAgentId) {
                return Promise.reject(
                    new Error("No lead agent ID found for the current user"),
                );
            }
            return service.createInvitation({
                agentEmail,
                parentAgentId: String(leadAgentId),
            });
        },
        onSuccess: (response) => {
            message.success(response.message || "Invitation sent successfully");
            queryClient.invalidateQueries({
                queryKey: [INVITATION_QUERY_KEY],
            });
            onCreateSuccess?.(response);
        },
        onError: (error) => {
            message.error(extractInvitationErrorMessage(error));
            onCreateError?.(error);
        },
    });

    /**
     * Send an invitation to an email address
     */
    const sendInvitation = (email: string) => {
        sendInvitationMutate(email);
    };

    return {
        // Data
        invitations,
        totalCount,
        totalPages,

        // Loading states
        isLoading,
        isSending,

        // Errors
        fetchError,
        createError,

        // Actions
        sendInvitation,
        refetch,

        // Pagination
        page,
        setPage,
        pageSize,

        // Auth info
        leadAgentId,
    };
};

export default useAgentInvitation;

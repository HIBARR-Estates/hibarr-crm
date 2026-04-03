/**
 * Agent Invitation Types & Interfaces
 *
 * Defines the contract for agent invitation operations with the external API.
 * Includes configuration, request/response types, and error classes.
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the agent invitation service
 */
export interface IAgentInvitationConfig {
    /** Base URL for the external API */
    baseUrl: string;
    /** API key for authentication */
    apiKey: string;
    /** Number of retry attempts for failed requests (default: 2, max: 5) */
    retryCount: number;
}

/**
 * Default configuration values (baseUrl and apiKey resolved from env at runtime)
 */
export const DEFAULT_INVITATION_CONFIG: Omit<
    IAgentInvitationConfig,
    "baseUrl" | "apiKey"
> = {
    retryCount: 2,
};

/**
 * Maximum allowed retry attempts
 */
export const MAX_INVITATION_RETRY_COUNT = 5;

// ============================================================================
// Invitation Status
// ============================================================================

export type InvitationStatus =
    | "pending_registration"
    | "pending_review"
    | "approved"
    | "rejected"
    | "expired";

// ============================================================================
// Request Types
// ============================================================================

/**
 * Payload for creating an agent invitation
 */
export interface ICreateInvitationPayload {
    agentEmail: string;
    parentAgentId: string;
}

/**
 * Query parameters for fetching invitations
 */
export interface IGetInvitationsParams {
    page?: number;
    limit?: number;
    parentAgentId?: string;
    crmParentAgentId?: string;
    sort?: "asc" | "desc";
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Single invitation record from the external API
 */
export interface IInvitation {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    parentAgentId: number;
    crmParentAgentId: string;
    status: InvitationStatus;
    tokenExpiresAt: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

/**
 * Response from creating an invitation
 */
export interface ICreateInvitationResponse {
    success: boolean;
    message: string;
}

/**
 * Paginated data wrapper for invitations
 */
export interface IInvitationPaginatedData {
    result: IInvitation[];
    totalCount: number;
    currentPage: string;
    totalPages: number;
    previousPage: string | null;
    nextPage: string | null;
    previusUrl: string | null;
    nextUrl: string | null;
}

/**
 * Response from fetching invitations
 */
export interface IGetInvitationsResponse {
    success: boolean;
    message: string;
    data: IInvitationPaginatedData;
}

// ============================================================================
// Service Interface
// ============================================================================

export interface IAgentInvitationService {
    createInvitation(
        payload: ICreateInvitationPayload,
    ): Promise<ICreateInvitationResponse>;
    getInvitations(
        params: IGetInvitationsParams,
    ): Promise<IGetInvitationsResponse>;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error class for invitation API failures
 */
export class InvitationApiError extends Error {
    public readonly statusCode?: number;
    public readonly originalError?: Error;

    constructor(message: string, statusCode?: number, originalError?: Error) {
        super(message);
        this.name = "InvitationApiError";
        this.statusCode = statusCode;
        this.originalError = originalError;
    }
}

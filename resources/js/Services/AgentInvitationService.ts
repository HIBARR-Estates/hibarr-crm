/**
 * Agent Invitation Service
 *
 * Centralized service for communicating with the external agent invitation API.
 * Features:
 * - Create agent invitations
 * - Fetch paginated invitations with filtering
 * - Configurable retry logic with exponential backoff
 */

import axios from "axios";
import {
    IAgentInvitationService,
    IAgentInvitationConfig,
    ICreateInvitationPayload,
    ICreateInvitationResponse,
    IGetInvitationsParams,
    IGetInvitationsResponse,
    InvitationApiError,
    MAX_INVITATION_RETRY_COUNT,
} from "@/Types/invitations";
import { getInvitationConfig } from "@/lib/config";

// ============================================================================
// Helper Functions
// ============================================================================

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const getBackoffDelay = (attempt: number, baseDelay: number = 1000): number => {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(exponentialDelay + jitter, 30000);
};

// ============================================================================
// Agent Invitation Service Class
// ============================================================================

export class AgentInvitationService implements IAgentInvitationService {
    private config: Required<IAgentInvitationConfig>;

    constructor(configOverrides?: Partial<IAgentInvitationConfig>) {
        this.config = getInvitationConfig(configOverrides);
    }

    // ========================================================================
    // Retry Logic
    // ========================================================================

    private async withRetry<T>(
        fn: () => Promise<T>,
        operation: string,
    ): Promise<T> {
        const maxRetries = Math.min(
            this.config.retryCount,
            MAX_INVITATION_RETRY_COUNT,
        );
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error));

                if (attempt < maxRetries) {
                    const delay = getBackoffDelay(attempt);
                    console.warn(
                        `[AgentInvitationService] Attempt ${attempt + 1}/${maxRetries + 1} failed for "${operation}". ` +
                            `Retrying in ${Math.round(delay)}ms...`,
                        error,
                    );
                    await sleep(delay);
                }
            }
        }

        throw new InvitationApiError(
            `${operation} failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
            undefined,
            lastError,
        );
    }

    // ========================================================================
    // API Operations
    // ========================================================================

    /**
     * Create an agent invitation
     */
    async createInvitation(
        payload: ICreateInvitationPayload,
    ): Promise<ICreateInvitationResponse> {
        return this.withRetry(async () => {
            const response = await axios.post<ICreateInvitationResponse>(
                `${this.config.baseUrl}/agents/invitations`,
                payload,
                {
                    headers: {
                        "X-Api-Key": this.config.apiKey,
                        "Content-Type": "application/json",
                    },
                },
            );

            return response.data;
        }, "createInvitation");
    }

    /**
     * Fetch paginated agent invitations
     */
    async getInvitations(
        params: IGetInvitationsParams,
    ): Promise<IGetInvitationsResponse> {
        return this.withRetry(async () => {
            const response = await axios.get<IGetInvitationsResponse>(
                `${this.config.baseUrl}/agents/invitations`,
                {
                    params,
                    headers: {
                        "X-Api-Key": this.config.apiKey,
                    },
                },
            );

            return response.data;
        }, "getInvitations");
    }

    // ========================================================================
    // Utility
    // ========================================================================

    /**
     * Update configuration
     */
    updateConfig(configOverrides: Partial<IAgentInvitationConfig>): void {
        this.config = getInvitationConfig({
            ...this.config,
            ...configOverrides,
        });
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultServiceInstance: AgentInvitationService | null = null;

/**
 * Get the default AgentInvitationService instance
 */
export const getAgentInvitationService = (
    configOverrides?: Partial<IAgentInvitationConfig>,
): AgentInvitationService => {
    if (!defaultServiceInstance || configOverrides) {
        defaultServiceInstance = new AgentInvitationService(configOverrides);
    }
    return defaultServiceInstance;
};

/**
 * Create a new AgentInvitationService instance
 */
export const createAgentInvitationService = (
    configOverrides?: Partial<IAgentInvitationConfig>,
): AgentInvitationService => {
    return new AgentInvitationService(configOverrides);
};

export default AgentInvitationService;

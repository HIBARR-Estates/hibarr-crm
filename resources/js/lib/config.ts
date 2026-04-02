/**
 * Application Configuration Helper
 *
 * Provides type-safe access to environment variables with fallback defaults.
 * Uses Vite's import.meta.env for frontend environment variable access.
 */

import {
    IFileUploadConfig,
    DEFAULT_UPLOAD_CONFIG,
    MAX_RETRY_COUNT,
} from "@/Types/uploads";
import {
    IAgentInvitationConfig,
    DEFAULT_INVITATION_CONFIG,
    MAX_INVITATION_RETRY_COUNT,
} from "@/Types/invitations";

// ============================================================================
// Environment Variable Types
// ============================================================================

/**
 * Expected Vite environment variables for file uploads
 */
interface FileUploadEnvVars {
    VITE_FILE_UPLOAD_BASE_URL?: string;
    VITE_FILE_UPLOAD_API_KEY?: string;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FILE_UPLOAD_BASE_URL = "https://staging-api.hibarr.org/v1";
const DEFAULT_AGENT_INVITATION_BASE_URL = "https://develop-api.hibarr.org/v1";
const DEFAULT_FILE_UPLOAD_API_KEY = "363769e1290c4d5ea6d351ef8c23dc6e";
const DEFAULT_AGENT_INVITATION_API_KEY = "7918aed08071453148048890d59a3b85";

// ============================================================================
// Configuration Getters
// ============================================================================

/**
 * Safely get an environment variable with a fallback
 */
const getEnvVar = (key: string, fallback: string): string => {
    // Access import.meta.env safely
    if (typeof import.meta !== "undefined" && import.meta.env) {
        const value = (import.meta.env as Record<string, string | undefined>)[
            key
        ];
        return value || fallback;
    }
    return fallback;
};

/**
 * Get the file upload base URL from environment or default
 */
export const getAgentInvitationBaseUrl = (): string => {
    return getEnvVar(
        "VITE_AGENT_INVITATION_BASE_URL",
        DEFAULT_AGENT_INVITATION_BASE_URL,
    );
};
export const getFileUploadBaseUrl = (): string => {
    return getEnvVar("VITE_FILE_UPLOAD_BASE_URL", DEFAULT_FILE_UPLOAD_BASE_URL);
};

/**
 * Get the file upload API key from environment or default
 */
export const getFileUploadApiKey = (): string => {
    return getEnvVar("VITE_FILE_UPLOAD_API_KEY", DEFAULT_FILE_UPLOAD_API_KEY);
};
export const getAgentInvitationApiKey = (): string => {
    return getEnvVar(
        "VITE_AGENT_INVITATION_API_KEY",
        DEFAULT_AGENT_INVITATION_API_KEY,
    );
};

/**
 * Clamp retry count to valid range (0 to MAX_RETRY_COUNT)
 */
export const clampRetryCount = (retryCount: number): number => {
    return Math.max(0, Math.min(retryCount, MAX_RETRY_COUNT));
};

/**
 * Get the complete file upload configuration
 * Merges environment variables with defaults and optional overrides
 *
 * @param overrides - Optional configuration overrides
 * @returns Complete file upload configuration
 */
export const getFileUploadConfig = (
    overrides?: Partial<IFileUploadConfig>,
): Required<IFileUploadConfig> => {
    const retryCount =
        overrides?.retryCount ?? DEFAULT_UPLOAD_CONFIG.retryCount;

    return {
        baseUrl: overrides?.baseUrl ?? getFileUploadBaseUrl(),
        apiKey: overrides?.apiKey ?? getFileUploadApiKey(),
        retryCount: clampRetryCount(retryCount),
        allowedTypes:
            overrides?.allowedTypes ?? DEFAULT_UPLOAD_CONFIG.allowedTypes,
        maxFileSize:
            overrides?.maxFileSize ?? DEFAULT_UPLOAD_CONFIG.maxFileSize,
        maxConcurrent:
            overrides?.maxConcurrent ?? DEFAULT_UPLOAD_CONFIG.maxConcurrent,
        defaultTargetFolder:
            overrides?.defaultTargetFolder ??
            DEFAULT_UPLOAD_CONFIG.defaultTargetFolder,
    };
};

// ============================================================================
// Agent Invitation Configuration
// ============================================================================

/**
 * Clamp invitation retry count to valid range (0 to MAX_INVITATION_RETRY_COUNT)
 */
export const clampInvitationRetryCount = (retryCount: number): number => {
    return Math.max(0, Math.min(retryCount, MAX_INVITATION_RETRY_COUNT));
};

/**
 * Get the complete agent invitation configuration
 * Reuses the same base URL and API key as the file upload service
 * (both communicate with the same external system)
 *
 * @param overrides - Optional configuration overrides
 * @returns Complete agent invitation configuration
 */
export const getInvitationConfig = (
    overrides?: Partial<IAgentInvitationConfig>,
): Required<IAgentInvitationConfig> => {
    const retryCount =
        overrides?.retryCount ?? DEFAULT_INVITATION_CONFIG.retryCount;

    return {
        baseUrl: overrides?.baseUrl ?? getAgentInvitationBaseUrl(),
        apiKey: overrides?.apiKey ?? getFileUploadApiKey(),
        retryCount: clampInvitationRetryCount(retryCount),
    };
};

// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Human-readable size string
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Generate a unique file ID
 * @param file - The file to generate an ID for
 * @returns Unique identifier string
 */
export const generateFileId = (file: File): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const sanitizedName = file.name
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 20);
    return `${timestamp}-${random}-${sanitizedName}`;
};

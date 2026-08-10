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
import {
    IOlConfig,
    DEFAULT_OL_CONFIG,
    MAX_OL_RETRY_COUNT,
} from "@/Types/qualification";

// ============================================================================
// Default Values
// ============================================================================

// `process` only exists under the Mix/webpack pipeline (DefinePlugin inlines
// process.env.MIX_* at build time) — the Vite pipeline has no such global, so
// every access below is guarded with `typeof process !== "undefined"`. Keep
// the `process.env.MIX_*` paths as static literal strings (not passed through
// a keyed helper) so webpack DefinePlugin / Vite can still inline them.
const hasProcessEnv = typeof process !== "undefined" && !!process.env;

const DEFAULT_FILE_UPLOAD_BASE_URL =
    (hasProcessEnv && process.env.MIX_FILE_UPLOAD_BASE_URL) ||
    "https://develop-api.hibarr.org/v1";
const DEFAULT_AGENT_INVITATION_BASE_URL =
    (hasProcessEnv && process.env.MIX_AGENT_INVITATION_BASE_URL) ||
    "https://develop-api.hibarr.org/v1";
const DEFAULT_FILE_UPLOAD_API_KEY =
    (hasProcessEnv && process.env.MIX_FILE_UPLOAD_API_KEY) || "";
const DEFAULT_AGENT_INVITATION_API_KEY =
    (hasProcessEnv && process.env.MIX_AGENT_INVITATION_API_KEY) || "";
const DEFAULT_OL_BASE_URL =
    (hasProcessEnv && process.env.MIX_OL_BASE_URL) ||
    "https://develop-api.hibarr.org/v1";
const DEFAULT_OL_API_KEY =
    (hasProcessEnv && process.env.MIX_OL_API_KEY) || DEFAULT_FILE_UPLOAD_API_KEY;

// ============================================================================
// Configuration Getters
// ============================================================================

/**
 * Get the agent invitation base URL from environment or default
 */
export const getAgentInvitationBaseUrl = (): string =>
    DEFAULT_AGENT_INVITATION_BASE_URL;

/**
 * Get the file upload base URL from environment or default
 */
export const getFileUploadBaseUrl = (): string => DEFAULT_FILE_UPLOAD_BASE_URL;

/**
 * Get the file upload API key from environment or default
 */
export const getFileUploadApiKey = (): string => DEFAULT_FILE_UPLOAD_API_KEY;

/**
 * Get the agent invitation API key from environment or default
 */
export const getAgentInvitationApiKey = (): string =>
    DEFAULT_AGENT_INVITATION_API_KEY;

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
        apiKey: overrides?.apiKey ?? getAgentInvitationApiKey(),
        retryCount: clampInvitationRetryCount(retryCount),
    };
};

// ============================================================================
// OL (Qualification / Registration) Configuration
// ============================================================================

export const getOlBaseUrl = (): string => {
    return (hasProcessEnv && process.env.MIX_OL_BASE_URL) || DEFAULT_OL_BASE_URL;
};

export const getOlApiKey = (): string => {
    return (hasProcessEnv && process.env.MIX_OL_API_KEY) || DEFAULT_OL_API_KEY;
};

export const clampOlRetryCount = (retryCount: number): number => {
    return Math.max(0, Math.min(retryCount, MAX_OL_RETRY_COUNT));
};

export const getOlConfig = (
    overrides?: Partial<IOlConfig>,
): Required<IOlConfig> => {
    const retryCount = overrides?.retryCount ?? DEFAULT_OL_CONFIG.retryCount;

    return {
        baseUrl: overrides?.baseUrl ?? getOlBaseUrl(),
        apiKey: overrides?.apiKey ?? getOlApiKey(),
        retryCount: clampOlRetryCount(retryCount),
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

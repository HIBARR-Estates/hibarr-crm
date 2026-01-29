/**
 * File Upload Types & Interfaces
 *
 * Defines the contract for file upload operations including single/multiple uploads,
 * deletions, progress tracking, abort/cancel support, and configurable retry logic.
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the file upload service
 */
export interface IFileUploadConfig {
    /** Base URL for the upload API */
    baseUrl: string;
    /** API key for authentication */
    apiKey: string;
    /** Number of retry attempts for failed uploads (default: 2, max: 5) */
    retryCount?: number;
    /** Allowed MIME types for upload validation */
    allowedTypes?: string[];
    /** Maximum file size in bytes */
    maxFileSize?: number;
    /** Maximum concurrent uploads (default: 3) */
    maxConcurrent?: number;
    /** Target folder for uploads */
    defaultTargetFolder?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_UPLOAD_CONFIG: Required<
    Omit<IFileUploadConfig, "baseUrl" | "apiKey">
> = {
    retryCount: 2,
    allowedTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxConcurrent: 3,
    defaultTargetFolder: "backend-uploads",
};

/**
 * Maximum allowed retry attempts
 */
export const MAX_RETRY_COUNT = 5;

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from a successful single file upload
 */
export interface IUploadResponseItem {
    /** Path to the uploaded file in storage */
    objectPath: string;
    /** Original filename */
    originalName: string;
    /** URL to download/access the file */
    downloadUrl: string;
}

/**
 * API response for upload operations
 */
export interface IUploadApiResponse {
    message: string;
    data: IUploadResponseItem[];
}

/**
 * Response from a successful file deletion
 */
export interface IDeleteResponseItem {
    /** Path of the deleted file */
    objectPath: string;
}

/**
 * API response for delete operations
 */
export interface IDeleteApiResponse {
    message: string;
    data: IDeleteResponseItem;
}

// ============================================================================
// Progress & Status Types
// ============================================================================

/**
 * Status of an individual file upload
 */
export type UploadStatus =
    | "pending"
    | "uploading"
    | "success"
    | "error"
    | "cancelled";

/**
 * Progress tracking for an individual file
 */
export interface IUploadProgress {
    /** Unique identifier for the file (generated UUID) */
    fileId: string;
    /** Original filename */
    fileName: string;
    /** Upload progress percentage (0-100) */
    progress: number;
    /** Current status of the upload */
    status: UploadStatus;
    /** Error message if status is 'error' */
    error?: string;
    /** Upload response data if status is 'success' */
    response?: IUploadResponseItem;
}

/**
 * Aggregate progress for multiple file uploads
 */
export interface IAggregateProgress {
    /** Total number of files */
    totalFiles: number;
    /** Number of completed uploads (success or error) */
    completedFiles: number;
    /** Number of successful uploads */
    successfulFiles: number;
    /** Number of failed uploads */
    failedFiles: number;
    /** Number of cancelled uploads */
    cancelledFiles: number;
    /** Overall progress percentage (0-100) */
    overallProgress: number;
    /** Whether any uploads are currently in progress */
    isUploading: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error for file validation failures
 */
export class FileValidationError extends Error {
    constructor(
        message: string,
        public readonly fileName: string,
        public readonly validationType: "size" | "type",
    ) {
        super(message);
        this.name = "FileValidationError";
    }
}

/**
 * Custom error for upload failures
 */
export class FileUploadError extends Error {
    constructor(
        message: string,
        public readonly fileName: string,
        public readonly statusCode?: number,
        public readonly originalError?: Error,
    ) {
        super(message);
        this.name = "FileUploadError";
    }
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Progress callback for tracking upload progress
 */
export type OnProgressCallback = (fileId: string, progress: number) => void;

/**
 * Interface for file upload service implementations
 * Provides methods for uploading, deleting, and managing files
 */
export interface IFileUploadService {
    /**
     * Upload a single file
     * @param file - The file to upload
     * @param targetFolder - Target folder in storage
     * @param onProgress - Optional progress callback
     * @returns Promise resolving to upload response
     */
    uploadSingle(
        file: File,
        targetFolder?: string,
        onProgress?: OnProgressCallback,
    ): Promise<IUploadResponseItem>;

    /**
     * Upload multiple files with concurrency control
     * @param files - Array of files to upload
     * @param targetFolder - Target folder in storage
     * @param onProgress - Optional progress callback (called per file)
     * @returns Promise resolving to array of upload responses
     */
    uploadMultiple(
        files: File[],
        targetFolder?: string,
        onProgress?: OnProgressCallback,
    ): Promise<IUploadResponseItem[]>;

    /**
     * Delete a single file
     * @param objectPath - Path of the file to delete
     * @returns Promise resolving to delete response
     */
    deleteSingle(objectPath: string): Promise<IDeleteResponseItem>;

    /**
     * Delete multiple files
     * @param objectPaths - Array of file paths to delete
     * @returns Promise resolving to array of delete responses
     */
    deleteMultiple(objectPaths: string[]): Promise<IDeleteResponseItem[]>;

    /**
     * Cancel a specific upload
     * @param fileId - ID of the file upload to cancel
     * @returns true if cancellation was successful
     */
    cancel(fileId: string): boolean;

    /**
     * Cancel all active uploads
     */
    cancelAll(): void;

    /**
     * Validate a file against configured constraints
     * @param file - The file to validate
     * @throws FileValidationError if validation fails
     */
    validateFile(file: File): void;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Options for the useFileUpload hook
 */
export interface IUseFileUploadOptions {
    /** Override retry count (default: 2, max: 5) */
    retryCount?: number;
    /** Override maximum concurrent uploads */
    maxConcurrent?: number;
    /** Override allowed file types */
    allowedTypes?: string[];
    /** Override maximum file size in bytes */
    maxFileSize?: number;
    /** Default target folder */
    targetFolder?: string;
    /** Callback when upload succeeds */
    onSuccess?: (response: IUploadResponseItem) => void;
    /** Callback when upload fails */
    onError?: (error: Error, fileName: string) => void;
    /** Callback when upload is cancelled */
    onCancel?: (fileId: string, fileName: string) => void;
}

/**
 * Return type for the useFileUpload hook
 */
export interface IUseFileUploadReturn {
    /**
     * Upload a single file
     */
    uploadSingle: (
        file: File,
        targetFolder?: string,
    ) => Promise<IUploadResponseItem>;

    /**
     * Upload multiple files
     */
    uploadMultiple: (
        files: File[],
        targetFolder?: string,
    ) => Promise<IUploadResponseItem[]>;

    /**
     * Delete a single file
     */
    deleteSingle: (objectPath: string) => Promise<IDeleteResponseItem>;

    /**
     * Delete multiple files
     */
    deleteMultiple: (objectPaths: string[]) => Promise<IDeleteResponseItem[]>;

    /**
     * Cancel a specific upload
     */
    cancel: (fileId: string) => void;

    /**
     * Cancel all active uploads
     */
    cancelAll: () => void;

    /**
     * Map of file IDs to their progress states
     */
    progressMap: Map<string, IUploadProgress>;

    /**
     * Aggregate progress across all uploads
     */
    aggregateProgress: IAggregateProgress;

    /**
     * Whether any uploads are currently in progress
     */
    isUploading: boolean;

    /**
     * Whether any deletions are currently in progress
     */
    isDeleting: boolean;

    /**
     * Current error if any
     */
    error: Error | null;

    /**
     * Reset all state (clear progress, errors, etc.)
     */
    reset: () => void;

    /**
     * Validate a file without uploading
     */
    validateFile: (file: File) => { valid: boolean; error?: string };
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for the FileUploader component
 */
export interface IFileUploaderProps {
    /** Target folder for uploads */
    targetFolder?: string;
    /** Allow multiple file selection */
    multiple?: boolean;
    /** Accepted file types (e.g., "image/*,.pdf") */
    accept?: string;
    /** Maximum file size in bytes */
    maxSize?: number;
    /** Maximum number of files (for multiple uploads) */
    maxFiles?: number;
    /** Maximum concurrent uploads */
    maxConcurrent?: number;
    /** Callback when upload succeeds */
    onSuccess?: (response: IUploadResponseItem | IUploadResponseItem[]) => void;
    /** Callback when upload fails */
    onError?: (error: Error, fileName: string) => void;
    /** Callback when upload is cancelled */
    onCancel?: (fileId: string, fileName: string) => void;
    /** Callback when files change (added/removed) */
    onChange?: (files: File[]) => void;
    /** Show progress indicators */
    showProgress?: boolean;
    /** External hook instance for shared state */
    uploadHook?: IUseFileUploadReturn;
    /** Disable the uploader */
    disabled?: boolean;
    /** Custom class name */
    className?: string;
    /** Children for custom trigger UI */
    children?: React.ReactNode;
    /** List type for Ant Design Upload */
    listType?: "text" | "picture" | "picture-card" | "picture-circle";
    /** Whether to show the upload list */
    showUploadList?: boolean;
}

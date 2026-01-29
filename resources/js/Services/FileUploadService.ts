/**
 * File Upload Service
 *
 * Implements IFileUploadService interface providing real file upload/delete
 * operations with the external upload API. Features include:
 * - Service-level file validation (size, type)
 * - Configurable retry logic with exponential backoff (default 2, max 5)
 * - Upload cancellation via AbortController
 * - Parallel uploads with configurable concurrency
 */

import axios, { AxiosError, CancelTokenSource } from "axios";
import {
    IFileUploadService,
    IFileUploadConfig,
    IUploadResponseItem,
    IUploadApiResponse,
    IDeleteResponseItem,
    IDeleteApiResponse,
    OnProgressCallback,
    FileValidationError,
    FileUploadError,
    DEFAULT_UPLOAD_CONFIG,
    MAX_RETRY_COUNT,
} from "@/Types/uploads";
import {
    getFileUploadConfig,
    generateFileId,
    formatFileSize,
} from "@/lib/config";

// Type for axios progress event (compatible with older versions)
interface AxiosProgressEvent {
    loaded: number;
    total?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for a specified duration
 */
const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @returns Delay in milliseconds
 */
const getBackoffDelay = (attempt: number, baseDelay: number = 1000): number => {
    // Exponential backoff with jitter: baseDelay * 2^attempt + random(0-500ms)
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
};

// ============================================================================
// File Upload Service Class
// ============================================================================

/**
 * File Upload Service implementation
 * Handles all file upload and deletion operations with the external API
 */
export class FileUploadService implements IFileUploadService {
    private config: Required<IFileUploadConfig>;
    private abortControllers: Map<string, AbortController> = new Map();
    private cancelTokenSources: Map<string, CancelTokenSource> = new Map();

    constructor(configOverrides?: Partial<IFileUploadConfig>) {
        this.config = getFileUploadConfig(configOverrides);
    }

    // ========================================================================
    // Validation
    // ========================================================================

    /**
     * Validate a file against configured constraints
     * @throws FileValidationError if validation fails
     */
    validateFile(file: File): void {
        // Check file size
        if (file.size > this.config.maxFileSize) {
            throw new FileValidationError(
                `File "${file.name}" exceeds maximum size of ${formatFileSize(this.config.maxFileSize)}. ` +
                    `Current size: ${formatFileSize(file.size)}`,
                file.name,
                "size",
            );
        }

        // Check file type
        if (
            this.config.allowedTypes.length > 0 &&
            !this.config.allowedTypes.includes(file.type)
        ) {
            throw new FileValidationError(
                `File "${file.name}" has invalid type "${file.type}". ` +
                    `Allowed types: ${this.config.allowedTypes.join(", ")}`,
                file.name,
                "type",
            );
        }
    }

    /**
     * Validate a file and return result (non-throwing version)
     */
    validateFileSafe(file: File): { valid: boolean; error?: string } {
        try {
            this.validateFile(file);
            return { valid: true };
        } catch (error) {
            if (error instanceof FileValidationError) {
                return { valid: false, error: error.message };
            }
            return { valid: false, error: "Unknown validation error" };
        }
    }

    // ========================================================================
    // Retry Logic
    // ========================================================================

    /**
     * Execute a function with retry logic
     */
    private async withRetry<T>(
        fn: () => Promise<T>,
        fileId: string,
        fileName: string,
    ): Promise<T> {
        const maxRetries = Math.min(this.config.retryCount, MAX_RETRY_COUNT);
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                // Don't retry if cancelled
                if (axios.isCancel(error)) {
                    throw error;
                }

                lastError =
                    error instanceof Error ? error : new Error(String(error));

                // Don't retry validation errors
                if (error instanceof FileValidationError) {
                    throw error;
                }

                // Check if we should retry
                if (attempt < maxRetries) {
                    const delay = getBackoffDelay(attempt);
                    console.warn(
                        `[FileUploadService] Attempt ${attempt + 1}/${maxRetries + 1} failed for "${fileName}". ` +
                            `Retrying in ${Math.round(delay)}ms...`,
                        error,
                    );
                    await sleep(delay);
                }
            }
        }

        throw new FileUploadError(
            `Upload failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
            fileName,
            undefined,
            lastError,
        );
    }

    // ========================================================================
    // Upload Operations
    // ========================================================================

    /**
     * Upload a single file
     */
    async uploadSingle(
        file: File,
        targetFolder?: string,
        onProgress?: OnProgressCallback,
    ): Promise<IUploadResponseItem> {
        // Validate file first
        this.validateFile(file);

        const fileId = generateFileId(file);
        const folder = targetFolder || this.config.defaultTargetFolder;

        // Create abort controller for this upload
        const abortController = new AbortController();
        this.abortControllers.set(fileId, abortController);

        // Create cancel token for axios
        const cancelSource = axios.CancelToken.source();
        this.cancelTokenSources.set(fileId, cancelSource);

        try {
            const result = await this.withRetry<IUploadResponseItem>(
                async (): Promise<IUploadResponseItem> => {
                    // Create form data
                    const formData = new FormData();
                    formData.append("file", file);

                    // Make the request
                    const response = await axios.post(
                        `${this.config.baseUrl}/upload`,
                        formData,
                        {
                            params: { targetFolder: folder },
                            headers: {
                                "X-Api-Key": this.config.apiKey,
                                "Content-Type": "multipart/form-data",
                            },
                            cancelToken: cancelSource.token,
                            onUploadProgress: (
                                progressEvent: AxiosProgressEvent,
                            ) => {
                                if (onProgress && progressEvent.total) {
                                    const progress = Math.round(
                                        (progressEvent.loaded * 100) /
                                            progressEvent.total,
                                    );
                                    onProgress(fileId, progress);
                                }
                            },
                        },
                    );

                    // API returns array, we take the first item for single upload
                    const responseData = response.data as IUploadApiResponse;
                    if (responseData.data && responseData.data.length > 0) {
                        return responseData.data[0];
                    }

                    throw new Error("Upload succeeded but no data returned");
                },
                fileId,
                file.name,
            );

            return result;
        } finally {
            // Cleanup
            this.abortControllers.delete(fileId);
            this.cancelTokenSources.delete(fileId);
        }
    }

    /**
     * Upload multiple files with concurrency control
     */
    async uploadMultiple(
        files: File[],
        targetFolder?: string,
        onProgress?: OnProgressCallback,
    ): Promise<IUploadResponseItem[]> {
        if (files.length === 0) {
            return [];
        }

        // Validate all files first
        for (const file of files) {
            this.validateFile(file);
        }

        const results: IUploadResponseItem[] = [];
        const errors: Error[] = [];
        const maxConcurrent = this.config.maxConcurrent;

        // Process files in batches with concurrency limit
        const processQueue = async (): Promise<void> => {
            const queue = [...files];
            const inProgress: Promise<void>[] = [];

            const processFile = async (file: File): Promise<void> => {
                try {
                    const result = await this.uploadSingle(
                        file,
                        targetFolder,
                        onProgress,
                    );
                    results.push(result);
                } catch (error) {
                    if (!axios.isCancel(error)) {
                        errors.push(
                            error instanceof Error
                                ? error
                                : new Error(String(error)),
                        );
                    }
                }
            };

            while (queue.length > 0 || inProgress.length > 0) {
                // Start new uploads up to concurrency limit
                while (queue.length > 0 && inProgress.length < maxConcurrent) {
                    const file = queue.shift()!;
                    const promise = processFile(file).then(() => {
                        const index = inProgress.indexOf(promise);
                        if (index > -1) {
                            inProgress.splice(index, 1);
                        }
                    });
                    inProgress.push(promise);
                }

                // Wait for at least one to complete if we're at capacity
                if (
                    inProgress.length >= maxConcurrent ||
                    (queue.length === 0 && inProgress.length > 0)
                ) {
                    await Promise.race(inProgress);
                }
            }
        };

        await processQueue();

        // If all uploads failed, throw an aggregate error
        if (errors.length > 0 && results.length === 0) {
            throw new FileUploadError(
                `All ${errors.length} uploads failed. First error: ${errors[0].message}`,
                files[0].name,
                undefined,
                errors[0],
            );
        }

        return results;
    }

    // ========================================================================
    // Delete Operations
    // ========================================================================

    /**
     * Delete a single file
     */
    async deleteSingle(objectPath: string): Promise<IDeleteResponseItem> {
        const response = await axios.delete<IDeleteApiResponse>(
            `${this.config.baseUrl}/upload`,
            {
                params: { objectPath },
                headers: {
                    "X-Api-Key": this.config.apiKey,
                },
            },
        );

        return response.data.data;
    }

    /**
     * Delete multiple files
     */
    async deleteMultiple(
        objectPaths: string[],
    ): Promise<IDeleteResponseItem[]> {
        if (objectPaths.length === 0) {
            return [];
        }

        // Delete in parallel with concurrency limit
        const results: IDeleteResponseItem[] = [];
        const maxConcurrent = this.config.maxConcurrent;
        const queue = [...objectPaths];

        while (queue.length > 0) {
            const batch = queue.splice(0, maxConcurrent);
            const batchResults = await Promise.all(
                batch.map((path) => this.deleteSingle(path)),
            );
            results.push(...batchResults);
        }

        return results;
    }

    // ========================================================================
    // Cancellation
    // ========================================================================

    /**
     * Cancel a specific upload
     */
    cancel(fileId: string): boolean {
        const abortController = this.abortControllers.get(fileId);
        const cancelSource = this.cancelTokenSources.get(fileId);

        if (abortController || cancelSource) {
            abortController?.abort();
            cancelSource?.cancel("Upload cancelled by user");
            this.abortControllers.delete(fileId);
            this.cancelTokenSources.delete(fileId);
            return true;
        }

        return false;
    }

    /**
     * Cancel all active uploads
     */
    cancelAll(): void {
        this.abortControllers.forEach((controller, fileId) => {
            controller.abort();
            this.abortControllers.delete(fileId);
        });

        this.cancelTokenSources.forEach((source, fileId) => {
            source.cancel("All uploads cancelled by user");
            this.cancelTokenSources.delete(fileId);
        });
    }

    // ========================================================================
    // Utility
    // ========================================================================

    /**
     * Get the number of active uploads
     */
    getActiveUploadCount(): number {
        return this.abortControllers.size;
    }

    /**
     * Check if a specific upload is active
     */
    isUploadActive(fileId: string): boolean {
        return this.abortControllers.has(fileId);
    }

    /**
     * Update configuration
     */
    updateConfig(configOverrides: Partial<IFileUploadConfig>): void {
        this.config = getFileUploadConfig({
            ...this.config,
            ...configOverrides,
        });
    }
}

// ============================================================================
// Singleton Instance (Optional)
// ============================================================================

let defaultServiceInstance: FileUploadService | null = null;

/**
 * Get the default FileUploadService instance
 * Creates one if it doesn't exist
 */
export const getFileUploadService = (
    configOverrides?: Partial<IFileUploadConfig>,
): FileUploadService => {
    if (!defaultServiceInstance || configOverrides) {
        defaultServiceInstance = new FileUploadService(configOverrides);
    }
    return defaultServiceInstance;
};

/**
 * Create a new FileUploadService instance
 * Use this when you need separate configuration from the default instance
 */
export const createFileUploadService = (
    configOverrides?: Partial<IFileUploadConfig>,
): FileUploadService => {
    return new FileUploadService(configOverrides);
};

export default FileUploadService;

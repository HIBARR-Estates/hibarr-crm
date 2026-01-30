/**
 * useFileUpload Hook
 *
 * React hook for managing file uploads with the FileUploadService.
 * Provides reactive state management for:
 * - Per-file progress tracking
 * - Aggregate progress for multiple uploads
 * - Upload/delete operations with callbacks
 * - Cancellation support
 */

import { useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import {
    IUseFileUploadOptions,
    IUseFileUploadReturn,
    IUploadProgress,
    IAggregateProgress,
    IUploadResponseItem,
    IDeleteResponseItem,
    UploadStatus,
    FileValidationError,
} from "@/Types/uploads";
import {
    FileUploadService,
    createFileUploadService,
} from "@/Services/FileUploadService";
import { generateFileId } from "@/lib/config";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate aggregate progress from a progress map
 */
const calculateAggregateProgress = (
    progressMap: Map<string, IUploadProgress>,
): IAggregateProgress => {
    if (progressMap.size === 0) {
        return {
            totalFiles: 0,
            completedFiles: 0,
            successfulFiles: 0,
            failedFiles: 0,
            cancelledFiles: 0,
            overallProgress: 0,
            isUploading: false,
        };
    }

    let totalProgress = 0;
    let successfulFiles = 0;
    let failedFiles = 0;
    let cancelledFiles = 0;
    let uploadingCount = 0;

    progressMap.forEach((progress) => {
        totalProgress += progress.progress;
        if (progress.status === "success") successfulFiles++;
        if (progress.status === "error") failedFiles++;
        if (progress.status === "cancelled") cancelledFiles++;
        if (progress.status === "uploading" || progress.status === "pending")
            uploadingCount++;
    });

    const totalFiles = progressMap.size;
    const completedFiles = successfulFiles + failedFiles + cancelledFiles;

    return {
        totalFiles,
        completedFiles,
        successfulFiles,
        failedFiles,
        cancelledFiles,
        overallProgress: Math.round(totalProgress / totalFiles),
        isUploading: uploadingCount > 0,
    };
};

// ============================================================================
// useFileUpload Hook
// ============================================================================

/**
 * Hook for managing file uploads with progress tracking and cancellation
 *
 * @param options - Configuration options for the hook
 * @returns Object with upload methods, progress state, and control functions
 *
 * @example
 * ```tsx
 * const {
 *   uploadSingle,
 *   uploadMultiple,
 *   progressMap,
 *   aggregateProgress,
 *   isUploading,
 *   cancel,
 *   cancelAll,
 * } = useFileUpload({
 *   maxConcurrent: 3,
 *   onSuccess: (response) => console.log('Uploaded:', response),
 *   onError: (error, fileName) => console.error('Failed:', fileName, error),
 * });
 *
 * // Upload a single file
 * const handleUpload = async (file: File) => {
 *   const result = await uploadSingle(file, 'my-folder');
 *   console.log('Uploaded to:', result.downloadUrl);
 * };
 * ```
 */
export function useFileUpload(
    options: IUseFileUploadOptions = {},
): IUseFileUploadReturn {
    const {
        retryCount,
        maxConcurrent,
        allowedTypes,
        maxFileSize,
        targetFolder,
        onSuccess,
        onError,
        onCancel,
    } = options;

    // State
    const [progressMap, setProgressMap] = useState<
        Map<string, IUploadProgress>
    >(new Map());
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Refs to track file ID to File mapping
    const fileIdMap = useRef<Map<string, File>>(new Map());

    // Create service instance with options
    const serviceRef = useRef<FileUploadService | null>(null);

    // Lazily create service to avoid recreating on every render
    const getService = useCallback(() => {
        if (!serviceRef.current) {
            serviceRef.current = createFileUploadService({
                retryCount,
                maxConcurrent,
                allowedTypes,
                maxFileSize,
                defaultTargetFolder: targetFolder,
            });
        }
        return serviceRef.current;
    }, [retryCount, maxConcurrent, allowedTypes, maxFileSize, targetFolder]);

    // ========================================================================
    // Progress Management
    // ========================================================================

    /**
     * Update progress for a specific file
     */
    const updateProgress = useCallback(
        (fileId: string, updates: Partial<IUploadProgress>) => {
            setProgressMap((prev) => {
                const newMap = new Map(prev);
                const existing = newMap.get(fileId);
                if (existing) {
                    newMap.set(fileId, { ...existing, ...updates });
                }
                return newMap;
            });
        },
        [],
    );

    /**
     * Initialize progress for a file
     */
    const initializeProgress = useCallback((file: File): string => {
        const fileId = generateFileId(file);
        fileIdMap.current.set(fileId, file);

        setProgressMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(fileId, {
                fileId,
                fileName: file.name,
                progress: 0,
                status: "pending",
            });
            return newMap;
        });

        return fileId;
    }, []);

    /**
     * Remove progress for a file
     */
    const removeProgress = useCallback((fileId: string) => {
        fileIdMap.current.delete(fileId);
        setProgressMap((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
        });
    }, []);

    // ========================================================================
    // Upload Operations
    // ========================================================================

    /**
     * Upload a single file
     */
    const uploadSingle = useCallback(
        async (file: File, folder?: string): Promise<IUploadResponseItem> => {
            const service = getService();
            const fileId = initializeProgress(file);
            setError(null);

            // Update to uploading status
            updateProgress(fileId, { status: "uploading" });

            try {
                const result = await service.uploadSingle(
                    file,
                    folder || targetFolder,
                    (id, progress) => {
                        updateProgress(id, { progress });
                    },
                );

                // Update to success status
                updateProgress(fileId, {
                    progress: 100,
                    status: "success",
                    response: result,
                });

                // Call success callback
                onSuccess?.(result);

                return result;
            } catch (err) {
                const error =
                    err instanceof Error ? err : new Error(String(err));

                // Check if cancelled
                if (axios.isCancel(err)) {
                    updateProgress(fileId, {
                        status: "cancelled",
                        error: "Upload cancelled",
                    });
                    onCancel?.(fileId, file.name);
                    throw error;
                }

                // Update to error status
                updateProgress(fileId, {
                    status: "error",
                    error: error.message,
                });

                // Call error callback
                onError?.(error, file.name);
                setError(error);

                throw error;
            }
        },
        [
            getService,
            initializeProgress,
            updateProgress,
            targetFolder,
            onSuccess,
            onError,
            onCancel,
        ],
    );

    /**
     * Upload multiple files
     */
    const uploadMultiple = useCallback(
        async (
            files: File[],
            folder?: string,
        ): Promise<IUploadResponseItem[]> => {
            if (files.length === 0) {
                return [];
            }

            setError(null);
            const results: IUploadResponseItem[] = [];
            const service = getService();
            const maxConcurrentUploads = maxConcurrent || 3;

            // Initialize progress for all files
            const fileIds = files.map((file) => initializeProgress(file));

            // Process files in batches
            const processFile = async (
                file: File,
                index: number,
            ): Promise<IUploadResponseItem | null> => {
                const fileId = fileIds[index];
                updateProgress(fileId, { status: "uploading" });

                try {
                    const result = await service.uploadSingle(
                        file,
                        folder || targetFolder,
                        (id, progress) => {
                            updateProgress(fileId, { progress });
                        },
                    );

                    updateProgress(fileId, {
                        progress: 100,
                        status: "success",
                        response: result,
                    });

                    onSuccess?.(result);
                    return result;
                } catch (err) {
                    const error =
                        err instanceof Error ? err : new Error(String(err));

                    if (axios.isCancel(err)) {
                        updateProgress(fileId, {
                            status: "cancelled",
                            error: "Upload cancelled",
                        });
                        onCancel?.(fileId, file.name);
                        return null;
                    }

                    updateProgress(fileId, {
                        status: "error",
                        error: error.message,
                    });

                    onError?.(error, file.name);
                    return null;
                }
            };

            // Process in batches with concurrency control
            const queue = [...files.entries()];

            while (queue.length > 0) {
                const batch = queue.splice(0, maxConcurrentUploads);
                const batchResults = await Promise.all(
                    batch.map(([index, file]) => processFile(file, index)),
                );
                results.push(
                    ...batchResults.filter(
                        (r): r is IUploadResponseItem => r !== null,
                    ),
                );
            }

            return results;
        },
        [
            getService,
            initializeProgress,
            updateProgress,
            maxConcurrent,
            targetFolder,
            onSuccess,
            onError,
            onCancel,
        ],
    );

    // ========================================================================
    // Delete Operations
    // ========================================================================

    /**
     * Delete a single file
     */
    const deleteSingle = useCallback(
        async (objectPath: string): Promise<IDeleteResponseItem> => {
            const service = getService();
            setIsDeleting(true);
            setError(null);

            try {
                const result = await service.deleteSingle(objectPath);
                return result;
            } catch (err) {
                const error =
                    err instanceof Error ? err : new Error(String(err));
                setError(error);
                throw error;
            } finally {
                setIsDeleting(false);
            }
        },
        [getService],
    );

    /**
     * Delete multiple files
     */
    const deleteMultiple = useCallback(
        async (objectPaths: string[]): Promise<IDeleteResponseItem[]> => {
            const service = getService();
            setIsDeleting(true);
            setError(null);

            try {
                const results = await service.deleteMultiple(objectPaths);
                return results;
            } catch (err) {
                const error =
                    err instanceof Error ? err : new Error(String(err));
                setError(error);
                throw error;
            } finally {
                setIsDeleting(false);
            }
        },
        [getService],
    );

    // ========================================================================
    // Cancellation
    // ========================================================================

    /**
     * Cancel a specific upload
     */
    const cancel = useCallback(
        (fileId: string) => {
            const service = getService();
            const file = fileIdMap.current.get(fileId);

            if (service.cancel(fileId)) {
                updateProgress(fileId, {
                    status: "cancelled",
                    error: "Upload cancelled",
                });
                if (file) {
                    onCancel?.(fileId, file.name);
                }
            }
        },
        [getService, updateProgress, onCancel],
    );

    /**
     * Cancel all active uploads
     */
    const cancelAll = useCallback(() => {
        const service = getService();
        service.cancelAll();

        setProgressMap((prev) => {
            const newMap = new Map(prev);
            newMap.forEach((progress, fileId) => {
                if (
                    progress.status === "uploading" ||
                    progress.status === "pending"
                ) {
                    newMap.set(fileId, {
                        ...progress,
                        status: "cancelled",
                        error: "Upload cancelled",
                    });
                    const file = fileIdMap.current.get(fileId);
                    if (file) {
                        onCancel?.(fileId, file.name);
                    }
                }
            });
            return newMap;
        });
    }, [getService, onCancel]);

    // ========================================================================
    // Utility
    // ========================================================================

    /**
     * Reset all state
     */
    const reset = useCallback(() => {
        const service = getService();
        service.cancelAll();
        fileIdMap.current.clear();
        setProgressMap(new Map());
        setError(null);
        setIsDeleting(false);
    }, [getService]);

    /**
     * Validate a file without uploading
     */
    const validateFile = useCallback(
        (file: File): { valid: boolean; error?: string } => {
            const service = getService();
            return service.validateFileSafe(file);
        },
        [getService],
    );

    // ========================================================================
    // Computed Values
    // ========================================================================

    /**
     * Aggregate progress across all uploads
     */
    const aggregateProgress = useMemo(
        () => calculateAggregateProgress(progressMap),
        [progressMap],
    );

    /**
     * Whether any uploads are in progress
     */
    const isUploading = useMemo(
        () => aggregateProgress.isUploading,
        [aggregateProgress.isUploading],
    );

    // ========================================================================
    // Return
    // ========================================================================

    return {
        uploadSingle,
        uploadMultiple,
        deleteSingle,
        deleteMultiple,
        cancel,
        cancelAll,
        progressMap,
        aggregateProgress,
        isUploading,
        isDeleting,
        error,
        reset,
        validateFile,
    };
}

export default useFileUpload;

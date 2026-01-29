/**
 * FileUploader Component Exports
 *
 * Re-exports for convenient importing of FileUploader and related types
 */

export { FileUploader, default } from "./FileUploader";

// Re-export types from uploads for convenience
export type {
    IFileUploaderProps,
    IUploadProgress,
    IUploadResponseItem,
    IDeleteResponseItem,
    IAggregateProgress,
    IUseFileUploadReturn,
    IUseFileUploadOptions,
    UploadStatus,
} from "@/Types/uploads";

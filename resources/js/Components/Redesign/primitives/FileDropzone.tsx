import { useRef, useState } from "react";
import Icon from "./Icon";
import { formatFileSize } from "@/lib/config";
import { REDESIGN_TOKENS as T } from "../tokens";

interface FileDropzoneProps {
    isUploading?: boolean;
    uploadProgress?: number;
    uploadBytesLoaded?: number;
    uploadBytesTotal?: number;    /** Primary line when idle, e.g. "Drop files here or click to upload". */
    dropHint: string;
    /** Primary line while uploading (without ellipsis/percent). */
    uploadingLabel: string;
    /** Secondary hint under the primary line. */
    sizeHint: string;
    disabled?: boolean;
    multiple?: boolean;
    accept?: string;
    onFilesSelected: (files: FileList | File[] | null) => void;
}

/** Shared dashed upload target used on lead + deal Files tabs. */
export default function FileDropzone({
    isUploading = false,
    uploadProgress = 0,
    uploadBytesLoaded = 0,
    uploadBytesTotal = 0,
    dropHint,    uploadingLabel,
    sizeHint,
    disabled = false,
    multiple = true,
    accept,
    onFilesSelected,
}: FileDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const interactive = !disabled && !isUploading;

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        if (!interactive) return;
        onFilesSelected(event.dataTransfer.files);
    };

    const showByteProgress =
        isUploading && uploadBytesTotal > 0 && uploadBytesLoaded > 0;

    return (        <div
            role="button"
            tabIndex={interactive ? 0 : -1}
            onClick={() => interactive && inputRef.current?.click()}
            onKeyDown={(event) => {
                if (!interactive) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    inputRef.current?.click();
                }
            }}
            onDragOver={(event) => {
                event.preventDefault();
                if (!disabled) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className="mb-3.5 rounded-lg border-2 border-dashed bg-white px-5 py-5 text-center transition-colors"
            style={{
                cursor: interactive ? "pointer" : "default",
                borderColor: isDragging ? T.BLUE : T.BORDER,
                background: isDragging ? T.BLUE_LIGHT : T.WHITE,
                opacity: disabled ? 0.6 : 1,
            }}
        >
                <input
                    ref={inputRef}
                    type="file"
                    multiple={multiple}
                    accept={accept}
                    className="hidden"
                    disabled={disabled || isUploading}
                    onChange={(event) => {
                        onFilesSelected(event.target.files);
                        event.target.value = "";
                    }}
                />
            <Icon
                name="paperclip"
                size={22}
                color={T.TEXT_HINT}
                className="mx-auto mb-1.5 opacity-60"
            />
            <div className="mb-1 text-[13px] font-medium text-[#1a1f2e]">
                {isUploading
                    ? uploadProgress > 0
                        ? `${uploadingLabel}… ${uploadProgress}%`
                        : `${uploadingLabel}…`
                    : dropHint}
            </div>
            {showByteProgress ? (
                <div className="mb-1 text-[12px] text-[#6b7280]">
                    {formatFileSize(uploadBytesLoaded)} /{" "}
                    {formatFileSize(uploadBytesTotal)}
                </div>
            ) : null}            {isUploading ? (
                <div
                    className="mx-auto mb-2 mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[#e5e7eb]"
                    role="progressbar"
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div
                        className="h-full rounded-full bg-[#1a6bb5] transition-[width] duration-150 ease-out"
                        style={{
                            width:
                                uploadProgress > 0
                                    ? `${uploadProgress}%`
                                    : "30%",
                        }}
                    />
                </div>
            ) : null}
            <div className="text-[12px] text-[#9ca3af]">{sizeHint}</div>
        </div>
    );
}

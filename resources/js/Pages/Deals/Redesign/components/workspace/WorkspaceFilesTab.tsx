import { useMemo, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import DeleteFile from "@/Pages/Deals/Components/Tabs/files/DeleteFile";
import {
    downloadDealFile,
    toWorkspaceFilePreview,
} from "../../adapters/fileAdapter";
import useDealFileUpload from "../../hooks/useDealFileUpload";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface WorkspaceFilesTabProps {
    deal: Deal;
    files: DealFile[];
    permissions: Record<string, string>;
}

function canViewFile(
    file: DealFile,
    permissions: Record<string, string>,
    userId?: number,
): boolean {
    return (
        permissions.view_lead_files === "all" ||
        (permissions.view_lead_files === "added" &&
            file.added_by === userId)
    );
}

function canAddFiles(permissions: Record<string, string>): boolean {
    return (
        permissions.add_lead_files === "all" ||
        permissions.add_lead_files === "added"
    );
}

function canDeleteFile(
    file: DealFile,
    permissions: Record<string, string>,
    userId?: number,
): boolean {
    return (
        permissions.delete_lead_files === "all" ||
        (permissions.delete_lead_files === "added" &&
            file.added_by === userId)
    );
}

export default function WorkspaceFilesTab({
    deal,
    files,
    permissions,
}: WorkspaceFilesTabProps) {
    const { td } = useTd();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const inputRef = useRef<HTMLInputElement>(null);
    const [deleteFile, setDeleteFile] = useState<DealFile | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const { uploadFiles, isUploading, uploadProgress } = useDealFileUpload(
        deal.id,
    );

    const visibleFiles = useMemo(
        () =>
            files
                .filter((file) => canViewFile(file, permissions, userId))
                .map((file) => toWorkspaceFilePreview(file)),
        [files, permissions, userId],
    );

    const showUpload = canAddFiles(permissions);

    const handleFilesSelected = async (fileList: FileList | File[] | null) => {
        if (!fileList || isUploading) return;

        const selected = Array.from(fileList);
        if (selected.length === 0) return;

        await uploadFiles(selected);
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);

        if (!showUpload) return;

        await handleFilesSelected(event.dataTransfer.files);
    };

    return (
        <>
            {showUpload && (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !isUploading && inputRef.current?.click()}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            inputRef.current?.click();
                        }
                    }}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className="mb-3.5 cursor-pointer rounded-lg border-2 border-dashed bg-white px-5 py-5 text-center transition-colors"
                    style={{
                        borderColor: isDragging ? T.BLUE : T.BORDER,
                        background: isDragging ? T.BLUE_LIGHT : T.WHITE,
                    }}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                            void handleFilesSelected(event.target.files);
                            event.target.value = "";
                        }}
                    />
                    <DealIcon
                        name="paperclip"
                        size={22}
                        color={T.TEXT_HINT}
                        className="mx-auto mb-1.5 opacity-60"
                    />
                    <div className="mb-1 text-[13px] font-medium text-[#1a1f2e]">
                        {isUploading
                            ? `${td("Uploading")}... ${uploadProgress}%`
                            : td("Drop files here or click to upload")}
                    </div>
                    <div className="text-[11px] text-[#9ca3af]">
                        {td("PDF, images, ZIP — max 200 MB")}
                    </div>
                </div>
            )}

            {visibleFiles.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {td("No files uploaded")}
                </p>
            ) : (
                visibleFiles.map((file) => (
                    <article
                        key={file.id}
                        className="mb-2 flex items-center gap-3 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-2.5 last:mb-0"
                    >
                        <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                            style={{ background: T.GRAY }}
                        >
                            <DealIcon
                                name={file.iconName}
                                size={17}
                                color={T.GRAY_DARKER}
                            />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-[#1a1f2e]">
                                {file.name}
                            </div>
                            <div className="text-[11px] text-[#9ca3af]">
                                {file.sizeLabel} · {td("Uploaded")}{" "}
                                {file.uploadedLabel}
                            </div>
                        </div>

                        <div className="flex shrink-0 gap-1.5">
                            <DealButton
                                variant="ghost"
                                onClick={() => downloadDealFile(file.file)}
                                style={{ fontSize: 11, padding: "3px 8px" }}
                                aria-label={td("Download")}
                            >
                                ↓
                            </DealButton>
                            {canDeleteFile(file.file, permissions, userId) && (
                                <DealButton
                                    variant="ghost"
                                    onClick={() => setDeleteFile(file.file)}
                                    style={{ fontSize: 11, padding: "3px 8px" }}
                                    aria-label={td("Delete")}
                                >
                                    ×
                                </DealButton>
                            )}
                        </div>
                    </article>
                ))
            )}

            <DeleteFile
                open={Boolean(deleteFile)}
                onClose={() => setDeleteFile(null)}
                file={deleteFile ?? undefined}
                onSuccess={() => setDeleteFile(null)}
            />
        </>
    );
}

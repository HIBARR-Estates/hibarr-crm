import { useMemo, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import type { PageProps } from "@/Components/DashboardLayout";
import { Button, ConfirmDialog, EmptyState, Icon } from "@/Components/Redesign";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { isLoading } from "@/lib/utils";
import type { LeadContactFile } from "@/Types/api/file";
import DealDocumentSlotRow from "@/Pages/Deals/Redesign/components/workspace/DealDocumentSlotRow";
import type { DealDocumentItem } from "@/Pages/Deals/Redesign/hooks/useDealDocuments";
import {
    downloadLeadContactFile,
    toLeadWorkspaceFilePreview,
} from "../../../adapters/fileAdapter";
import { canEditLead } from "../../../adapters/leadEditAccess";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadDocumentUpload from "../../../hooks/useLeadDocumentUpload";
import useLeadDocuments from "../../../hooks/useLeadDocuments";
import useLeadFileUpload from "../../../hooks/useLeadFileUpload";

interface FilesTabProps {
    fields?: Array<{
        id: number;
        label?: string;
        name?: string;
        type?: string;
    }>;
    editLeadPermission?: string;
}

/**
 * Lead Files tab — document slots (file custom fields) + freeform multi-upload,
 * mirroring the deal WorkspaceFilesTab pattern.
 */
export default function FilesTab({
    fields = [],
    editLeadPermission,
}: FilesTabProps) {
    const { td } = useTd();
    const { props } = usePage<PageProps>();
    const userId = props.auth?.user?.id;
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [deleteFile, setDeleteFile] = useState<LeadContactFile | null>(null);

    const { lead, files, setFiles, filesLoading } = useLeadWorkspace();
    const canEdit = canEditLead(editLeadPermission, lead, userId);

    const { uploadFiles, isUploading, uploadProgress } = useLeadFileUpload(
        lead.id,
    );
    const { slots } = useLeadDocuments(lead, fields);
    const {
        uploadToSlot,
        deleteSlot,
        isUploadingField,
        isDeletingField,
        canEdit: canEditFields,
    } = useLeadDocumentUpload(editLeadPermission);

    const deletePath = deleteFile?.id
        ? route("lead-contact-files.destroy", deleteFile.id)
        : "/lead-contact-files/0";

    const { mutate: destroyFile, status: destroyStatus } = useApiMutate<
        null,
        null,
        ApiResponse<null>
    >(deletePath, "DELETE");

    const visibleFiles = useMemo(
        () => files.map((file) => toLeadWorkspaceFilePreview(file)),
        [files],
    );

    const handleFilesSelected = async (fileList: FileList | File[] | null) => {
        if (!fileList || isUploading) return;
        const selected = Array.from(fileList);
        if (selected.length === 0) return;
        await uploadFiles(selected);
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        if (!canEdit) return;
        await handleFilesSelected(event.dataTransfer.files);
    };

    const confirmDelete = () => {
        if (!deleteFile?.id) return;
        destroyFile(null, {
            onSuccess: () => {
                const deletedId = deleteFile.id;
                setDeleteFile(null);
                setFiles((prev) => prev.filter((item) => item.id !== deletedId));
                message.success(td("File deleted"));
            },
            onError: () => {
                message.error(td("Could not delete file"));
            },
        });
    };

    return (
        <div>
            {slots.length > 0 ? (
                <section className="mb-5">
                    <div className="mb-1 text-[14px] font-bold text-[#1a1f2e]">
                        {td("Documents")}
                    </div>
                    <div className="mb-2 text-[12px] text-[#9ca3af]">
                        {td(
                            "Required or optional file fields for this lead. Upload each into its slot.",
                        )}
                    </div>
                    <div className="rounded-lg border border-[#e2e5ea] bg-white px-3.5">
                        {slots.map((doc) => (
                            <DealDocumentSlotRow
                                key={doc.id}
                                doc={doc as unknown as DealDocumentItem}
                                variant="full"
                                onUpload={(slot, file) =>
                                    uploadToSlot(
                                        slot as unknown as typeof doc,
                                        file,
                                    )
                                }
                                onDelete={(slot) =>
                                    deleteSlot(slot as unknown as typeof doc)
                                }
                                uploading={isUploadingField(doc.fieldName)}
                                deleting={isDeletingField(doc.fieldName)}
                                disabled={!canEditFields}
                            />
                        ))}
                    </div>
                </section>
            ) : null}

            {slots.length > 0 ? (
                <div className="mb-2 text-[14px] font-bold text-[#1a1f2e]">
                    {td("Other files")}
                </div>
            ) : null}

            {canEdit ? (
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
                    className={`v2-dropzone mb-3.5 cursor-pointer${
                        isDragging ? " is-dragging" : ""
                    }`}
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
                    <Icon
                        name="paperclip"
                        size={22}
                        className="mx-auto mb-1.5 opacity-60"
                    />
                    <p className="mb-1 text-[13px] font-medium text-[#1a1f2e]">
                        {isUploading
                            ? uploadProgress > 0
                                ? `${td("Uploading")}… ${uploadProgress}%`
                                : `${td("Uploading")}…`
                            : td("Drop files here or click to upload")}
                    </p>
                    {isUploading ? (
                        <div
                            className="mx-auto mb-2 mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[#e5e7eb]"
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
                                    animation:
                                        uploadProgress > 0
                                            ? undefined
                                            : "pulse 1s ease-in-out infinite",
                                }}
                            />
                        </div>
                    ) : null}
                    <p className="text-[12px] text-[#9ca3af]">
                        {td("You can select multiple files at once.")}
                    </p>
                </div>
            ) : null}

            {filesLoading ? (
                <p className="px-1 text-[13px] text-[#9ca3af]">
                    {td("Loading files…")}
                </p>
            ) : visibleFiles.length === 0 ? (
                <EmptyState
                    title={td("No other files")}
                    description={
                        slots.length > 0
                            ? td(
                                  "Loose uploads appear here. Document slots are listed above.",
                              )
                            : td(
                                  "Upload files related to this lead. They stay on the lead, not on deals.",
                              )
                    }
                />
            ) : (
                visibleFiles.map((file) => (
                    <article
                        key={file.id}
                        className="v2-file-card mb-2 flex items-center gap-3 last:mb-0"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f3f4f6]">
                            <Icon name={file.iconName} size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-[#1a1f2e]">
                                {file.name}
                            </div>
                            <div className="text-[12px] text-[#9ca3af]">
                                {file.sizeLabel} · {td("Uploaded")}{" "}
                                {file.uploadedLabel}
                            </div>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    downloadLeadContactFile(file.file)
                                }
                                aria-label={td("Download")}
                            >
                                <Icon name="external-link" size={13} />
                            </Button>
                            {canEdit ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteFile(file.file)}
                                    aria-label={td("Delete")}
                                >
                                    <Icon name="x" size={13} />
                                </Button>
                            ) : null}
                        </div>
                    </article>
                ))
            )}

            <ConfirmDialog
                open={Boolean(deleteFile)}
                title={td("Delete file")}
                message={
                    deleteFile
                        ? td(
                              `Are you sure you want to delete ${deleteFile.filename}? This cannot be undone.`,
                          )
                        : td("Delete this file?")
                }
                confirmLabel={td("Delete")}
                cancelLabel={td("Cancel")}
                danger
                confirmLoading={isLoading({ status: destroyStatus })}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteFile(null)}
            />
        </div>
    );
}

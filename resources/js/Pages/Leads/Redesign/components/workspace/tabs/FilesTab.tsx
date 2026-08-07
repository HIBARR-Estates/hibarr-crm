import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import {
    AttachmentFileCard,
    ConfirmDialog,
    FileDropzone,
} from "@/Components/Redesign";
import type { PageProps } from "@/Components/DashboardLayout";
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
 * mirroring the deal WorkspaceFilesTab pattern (shared dropzone + file cards).
 */
export default function FilesTab({
    fields = [],
    editLeadPermission,
}: FilesTabProps) {
    const { td } = useTd();
    const { props } = usePage<PageProps>();
    const userId = props.auth?.user?.id;
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
                <FileDropzone
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    dropHint={td("Drop files here or click to upload")}
                    uploadingLabel={td("Uploading")}
                    sizeHint={td("PDF, images, ZIP — max 200 MB")}
                    onFilesSelected={(fileList) => {
                        void handleFilesSelected(fileList);
                    }}
                />
            ) : null}

            {filesLoading ? (
                <p className="px-1 text-[13px] text-[#9ca3af]">
                    {td("Loading files…")}
                </p>
            ) : visibleFiles.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {td("No files uploaded")}
                </p>
            ) : (
                visibleFiles.map((file) => (
                    <AttachmentFileCard
                        key={file.id}
                        name={file.name}
                        sizeLabel={file.sizeLabel}
                        uploadedLabel={file.uploadedLabel}
                        uploadedPrefix={td("Uploaded")}
                        iconName={file.iconName}
                        downloadLabel={td("Download")}
                        deleteLabel={td("Delete")}
                        onDownload={() => downloadLeadContactFile(file.file)}
                        onDelete={
                            canEdit
                                ? () => setDeleteFile(file.file)
                                : undefined
                        }
                    />
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

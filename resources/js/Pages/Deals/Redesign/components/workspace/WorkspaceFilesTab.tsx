import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import { AttachmentFileCard, FileDropzone } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import {
    downloadDealFile,
    toWorkspaceFilePreview,
} from "../../adapters/fileAdapter";
import useDealFileUpload from "../../hooks/useDealFileUpload";
import useDealDocuments from "../../hooks/useDealDocuments";
import useDealDocumentUpload from "../../hooks/useDealDocumentUpload";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealDocumentSlotRow from "./DealDocumentSlotRow";
import { FilesEmptyState } from "@/Components/Redesign/workspace/WorkspaceEmptyStates";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";

interface WorkspaceFilesTabProps {
    deal: Deal;
    files: DealFile[];
    permissions: Record<string, string>;
    /** Custom field definitions — file-typed ones become document slots. */
    fields?: Array<{
        id: number;
        label?: string;
        name?: string;
        type?: string;
        custom_field_category_id?: string | number;
    }>;
    /** Pipeline-linked category ids — scopes which custom file fields show. */
    categoryIds?: number[];
}

function fileOwnerId(file: DealFile): number | undefined {
    const raw = file.added_by ?? file.user_id;
    if (raw == null) return undefined;
    const id = Number(raw);
    return Number.isFinite(id) ? id : undefined;
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
    if (permissions.delete_lead_files === "all") return true;
    if (permissions.delete_lead_files !== "added") return false;
    const ownerId = fileOwnerId(file);
    return ownerId != null && userId != null && ownerId === Number(userId);
}

/** Page props omit some file perms — fall back to auth.permissions. */
function resolveFilePermissions(
    pagePermissions: Record<string, string>,
    authPermissions: Record<string, string> | undefined,
): Record<string, string> {
    const auth = authPermissions ?? {};
    return {
        view_lead_files:
            pagePermissions.view_lead_files ?? auth.view_lead_files,
        add_lead_files: pagePermissions.add_lead_files ?? auth.add_lead_files,
        delete_lead_files:
            pagePermissions.delete_lead_files ?? auth.delete_lead_files,
    };
}

export default function WorkspaceFilesTab({
    deal,
    files,
    permissions,
    fields = [],
    categoryIds,
}: WorkspaceFilesTabProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const filePermissions = resolveFilePermissions(
        permissions,
        props.auth?.permissions as Record<string, string> | undefined,
    );
    const [deleteFile, setDeleteFile] = useState<DealFile | null>(null);
    const { uploadFiles, isUploading, uploadProgress } = useDealFileUpload(
        deal.id,
    );
    const { setFiles } = useDealWorkspace();

    const deletePath = deleteFile?.id
        ? route("deal-files.destroy", deleteFile.id)
        : "/deal-files/0";

    const { mutate: destroyFile, status: destroyStatus } = useApiMutate<
        null,
        null,
        ApiResponse<null>
    >(deletePath, "DELETE");

    // Server already scopes deals.files.index by view_lead_files — don't
    // re-filter client-side (that was hiding every file when the page
    // permissions payload was incomplete or type-mismatched).
    const visibleFiles = useMemo(
        () => files.map((file) => toWorkspaceFilePreview(file)),
        [files],
    );

    const showUpload = canAddFiles(filePermissions);

    // Document slots = HIBARR document fields + file-typed custom fields from
    // the pipeline's categories. These are updated in place on their own
    // field, not uploaded as loose deal files.
    const { slots } = useDealDocuments(deal, files, fields, categoryIds);
    const {
        uploadToSlot,
        deleteSlot,
        isUploadingField,
        isDeletingField,
        canEdit: canEditFields,
    } = useDealDocumentUpload();

    const handleFilesSelected = async (fileList: FileList | File[] | null) => {
        if (!fileList || isUploading) return;

        const selected = Array.from(fileList);
        if (selected.length === 0) return;

        await uploadFiles(selected);
    };

    const confirmDelete = () => {
        if (!deleteFile?.id) return;
        const deletedId = deleteFile.id;
        destroyFile(null, {
            onSuccess: () => {
                setDeleteFile(null);
                setFiles((prev) =>
                    prev.filter((item) => item.id !== deletedId),
                );
                message.success(
                    t("pages.deals.workspace.files.messages.deleted"),
                );
            },
            onError: () => {
                message.error(
                    t("pages.deals.workspace.files.messages.delete_failed"),
                );
            },
        });
    };

    return (
        <>
            {slots.length > 0 && (
                <section className="mb-5">
                    <div className="mb-1 text-[14px] font-bold text-[#1a1f2e]">
                        {t("pages.deals.workspace.documents.section_title")}
                    </div>
                    <div
                        className="mb-2 text-[12px]"
                        style={{ color: T.TEXT_HINT }}
                    >
                        {t("pages.deals.workspace.documents.section_hint")}
                    </div>
                    <div className="rounded-lg border border-[#e2e5ea] bg-white px-3.5">
                        {slots.map((doc) => (
                            <DealDocumentSlotRow
                                key={doc.id}
                                doc={doc}
                                variant="full"
                                onUpload={uploadToSlot}
                                onDelete={deleteSlot}
                                uploading={isUploadingField(doc.fieldName)}
                                deleting={isDeletingField(doc.fieldName)}
                                disabled={!canEditFields}
                            />
                        ))}
                    </div>
                </section>
            )}

            {slots.length > 0 && (
                <div className="mb-2 text-[14px] font-bold text-[#1a1f2e]">
                    {t("pages.deals.workspace.files.other_files")}
                </div>
            )}

            {showUpload && (
                <FileDropzone
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    dropHint={t("pages.deals.workspace.files.drop_hint")}
                    uploadingLabel={t("pages.deals.workspace.files.uploading")}
                    sizeHint={t("pages.deals.workspace.files.size_hint")}
                    onFilesSelected={(fileList) => {
                        void handleFilesSelected(fileList);
                    }}
                />
            )}

            {visibleFiles.length === 0 ? (
                <FilesEmptyState
                    title={t("pages.deals.workspace.files.empty")}
                />
            ) : (
                visibleFiles.map((file) => (
                    <AttachmentFileCard
                        key={file.id}
                        name={file.name}
                        sizeLabel={file.sizeLabel}
                        uploadedLabel={
                            file.uploadedLabel === "recently"
                                ? t("pages.deals.common.recently")
                                : file.uploadedLabel
                        }
                        uploadedPrefix={t(
                            "pages.deals.workspace.files.uploaded_label",
                        )}
                        iconName={file.iconName}
                        downloadLabel={t(
                            "pages.deals.workspace.files.download",
                        )}
                        deleteLabel={t("pages.deals.common.delete")}
                        onDownload={() => downloadDealFile(file.file)}
                        onDelete={
                            canDeleteFile(file.file, filePermissions, userId)
                                ? () => setDeleteFile(file.file)
                                : undefined
                        }
                    />
                ))
            )}

            <DealConfirmDialog
                open={Boolean(deleteFile)}
                title={t("pages.deals.common.delete")}
                message={
                    deleteFile
                        ? t(
                              "pages.deals.workspace.files.delete_confirm_message",
                          )
                        : t(
                              "pages.deals.workspace.files.delete_confirm_message",
                          )
                }
                confirmLabel={t("pages.deals.common.delete")}
                danger
                confirmLoading={isLoading({ status: destroyStatus })}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteFile(null)}
            />
        </>
    );
}

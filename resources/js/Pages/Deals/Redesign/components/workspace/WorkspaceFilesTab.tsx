import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import { message } from "antd";
import {
    AttachmentFileCard,
    FileDropzone,
} from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import useDealFilesGroupingFlag from "@/Hooks/useDealFilesGroupingFlag";
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
import useDealDocuments, { type DealDocumentItem } from "../../hooks/useDealDocuments";
import useDealDocumentUpload from "../../hooks/useDealDocumentUpload";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealDocumentSlotRow from "./DealDocumentSlotRow";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";

interface DocumentSlotSectionProps {
    title: string;
    hint: string;
    slots: DealDocumentItem[];
    onUpload: (doc: DealDocumentItem, file: File) => void;
    onDelete: (doc: DealDocumentItem) => void | Promise<void>;
    isUploadingField: (fieldName?: string) => boolean;
    isDeletingField: (fieldName?: string) => boolean;
    disabled: boolean;
}

/** One card of document slots — "Documents" (this deal's own fields) and "Personal files" (lead-owned fields cross-populated here) render identically, just with different data/labels. */
function DocumentSlotSection({
    title,
    hint,
    slots,
    onUpload,
    onDelete,
    isUploadingField,
    isDeletingField,
    disabled,
}: DocumentSlotSectionProps) {
    if (slots.length === 0) return null;

    return (
        <section className="mb-5">
            <div className="mb-1 text-[14px] font-bold text-[#1a1f2e]">{title}</div>
            <div className="mb-2 text-[12px]" style={{ color: T.TEXT_HINT }}>
                {hint}
            </div>
            <div className="rounded-lg border border-[#e2e5ea] bg-white px-3.5">
                {slots.map((doc) => (
                    <DealDocumentSlotRow
                        key={doc.id}
                        doc={doc}
                        variant="full"
                        onUpload={onUpload}
                        onDelete={onDelete}
                        uploading={isUploadingField(doc.fieldName)}
                        deleting={isDeletingField(doc.fieldName)}
                        disabled={disabled}
                    />
                ))}
            </div>
        </section>
    );
}

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
    /** Field visibility (deal-context-aware) — see useDealDocuments. */
    visibilityMap?: Record<number, boolean>;
    /** Lead-owned FILE fields gated by pipeline — see useDealDocuments. */
    leadFileFields?: Array<{
        id: number;
        label?: string;
        name?: string;
        type?: string;
        custom_field_category_id?: string | number;
    }>;
    leadFileFieldsData?: Record<string, unknown>;
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
    visibilityMap,
    leadFileFields = [],
    leadFileFieldsData = {},
}: WorkspaceFilesTabProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const filesGroupingEnabled = useDealFilesGroupingFlag();
    const filePermissions = resolveFilePermissions(
        permissions,
        props.auth?.permissions as Record<string, string> | undefined,
    );
    // There is no dedicated "edit_lead_files" permission in this system (only
    // view/add/delete exist) — renaming a loose file is gated the same way as
    // editing a deal's document slots (useDealDocumentUpload): can this user
    // edit the deal at all.
    const { canEdit: canEditDeal } = useDealPermissions(deal);
    const [deleteFile, setDeleteFile] = useState<DealFile | null>(null);
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [replacingId, setReplacingId] = useState<number | null>(null);
    const { uploadFiles, isUploading, uploadProgress } = useDealFileUpload(
        deal.id,
    );
    const { setFiles } = useDealWorkspace();

    const handleRename = async (file: DealFile, label: string) => {
        setRenamingId(file.id);
        try {
            const res = await axios.put(
                route("deal-files.update", file.id),
                { description: label },
                { headers: { Accept: "application/json" } },
            );
            if (res.data?.data) {
                setFiles((prev) =>
                    prev.map((f) => (f.id === file.id ? { ...f, description: label } : f)),
                );
                message.success(t("pages.deals.workspace.files.messages.renamed"));
            } else {
                message.error(
                    res.data?.message || t("pages.deals.workspace.files.messages.rename_failed"),
                );
            }
        } catch (error: any) {
            message.error(
                error?.response?.data?.message ||
                    t("pages.deals.workspace.files.messages.rename_failed"),
            );
        } finally {
            setRenamingId(null);
        }
    };

    const handleReplace = async (file: DealFile, newFile: File) => {
        setReplacingId(file.id);
        try {
            const formData = new FormData();
            formData.append("_method", "PUT");
            formData.append("file", newFile);
            const res = await axios.post(
                route("deal-files.update", file.id),
                formData,
                { headers: { Accept: "application/json" } },
            );
            if (res.data?.data) {
                setFiles((prev) =>
                    prev.map((f) => (f.id === file.id ? { ...f, ...res.data.data } : f)),
                );
                message.success(t("pages.deals.workspace.files.messages.replaced"));
            } else {
                message.error(
                    res.data?.message || t("pages.deals.workspace.files.messages.replace_failed"),
                );
            }
        } catch (error: any) {
            message.error(
                error?.response?.data?.message ||
                    t("pages.deals.workspace.files.messages.replace_failed"),
            );
        } finally {
            setReplacingId(null);
        }
    };

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
    const { slots } = useDealDocuments(
        deal,
        files,
        fields,
        categoryIds,
        visibilityMap,
        leadFileFields,
        leadFileFieldsData,
    );
    // Lead-owned fields cross-populated here (source: "lead") get their own
    // "Personal files" section — they belong to the person, not this deal —
    // separate from this deal's own Documents.
    const documentSlots = useMemo(
        () => slots.filter((doc) => doc.source !== "lead"),
        [slots],
    );
    const personalSlots = useMemo(
        () => slots.filter((doc) => doc.source === "lead"),
        [slots],
    );
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
                setFiles((prev) => prev.filter((item) => item.id !== deletedId));
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

    const dropzone = showUpload && (
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
    );

    return (
        <>
            {filesGroupingEnabled && dropzone}

            <DocumentSlotSection
                title={t("pages.deals.workspace.documents.section_title")}
                hint={t("pages.deals.workspace.documents.section_hint")}
                slots={documentSlots}
                onUpload={uploadToSlot}
                onDelete={deleteSlot}
                isUploadingField={isUploadingField}
                isDeletingField={isDeletingField}
                disabled={!canEditFields}
            />

            <DocumentSlotSection
                title={t("pages.deals.workspace.documents.personal_section_title")}
                hint={t("pages.deals.workspace.documents.personal_section_hint")}
                slots={personalSlots}
                onUpload={uploadToSlot}
                onDelete={deleteSlot}
                isUploadingField={isUploadingField}
                isDeletingField={isDeletingField}
                disabled={!canEditFields}
            />

            {slots.length > 0 && (
                <div className="mb-2 text-[14px] font-bold text-[#1a1f2e]">
                    {t("pages.deals.workspace.files.other_files")}
                </div>
            )}

            {!filesGroupingEnabled && dropzone}

            {visibleFiles.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {t("pages.deals.workspace.files.empty")}
                </p>
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
                        onRename={
                            canEditDeal
                                ? (label) => handleRename(file.file, label)
                                : undefined
                        }
                        renameLabel={t("pages.deals.workspace.files.rename")}
                        renameSaveLabel={t("pages.deals.common.save")}
                        renameCancelLabel={t("pages.deals.common.cancel")}
                        renamePlaceholder={t("pages.deals.workspace.files.rename_placeholder")}
                        renaming={renamingId === file.file.id}
                        onReplace={
                            canEditDeal
                                ? (newFile) => handleReplace(file.file, newFile)
                                : undefined
                        }
                        replaceLabel={t("pages.deals.workspace.files.replace")}
                        replacing={replacingId === file.file.id}
                    />
                ))
            )}

            <DealConfirmDialog
                open={Boolean(deleteFile)}
                title={t("pages.deals.common.delete")}
                message={
                    deleteFile
                        ? t("pages.deals.workspace.files.delete_confirm_message")
                        : t("pages.deals.workspace.files.delete_confirm_message")
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

import { useMemo, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import DeleteFile from "@/Pages/Deals/Components/Tabs/files/DeleteFile";
import {
    downloadDealFile,
    toWorkspaceFilePreview,
} from "../../adapters/fileAdapter";
import useDealFileUpload from "../../hooks/useDealFileUpload";
import useDealDocuments from "../../hooks/useDealDocuments";
import useDealDocumentUpload from "../../hooks/useDealDocumentUpload";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import DealDocumentSlotRow from "./DealDocumentSlotRow";
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
    fields = [],
    categoryIds,
}: WorkspaceFilesTabProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const inputRef = useRef<HTMLInputElement>(null);
    const [deleteFile, setDeleteFile] = useState<DealFile | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const { uploadFiles, isUploading, uploadProgress } = useDealFileUpload(
        deal.id,
    );
    const { setFiles } = useDealWorkspace();

    const visibleFiles = useMemo(
        () =>
            files
                .filter((file) => canViewFile(file, permissions, userId))
                .map((file) => toWorkspaceFilePreview(file)),
        [files, permissions, userId],
    );

    const showUpload = canAddFiles(permissions);

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

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);

        if (!showUpload) return;

        await handleFilesSelected(event.dataTransfer.files);
    };

    return (
        <>
            {slots.length > 0 && (
                <section className="mb-5">
                    <div className="mb-1 text-[14px] font-bold text-[#1a1f2e]">
                        {t("pages.deals.workspace.documents.section_title")}
                    </div>
                    <div className="mb-2 text-[12px]" style={{ color: T.TEXT_HINT }}>
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
                            ? uploadProgress > 0
                                ? `${t("pages.deals.workspace.files.uploading")}… ${uploadProgress}%`
                                : `${t("pages.deals.workspace.files.uploading")}…`
                            : t("pages.deals.workspace.files.drop_hint")}
                    </div>
                    {isUploading ? (
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
                    <div className="text-[12px] text-[#9ca3af]">
                        {t("pages.deals.workspace.files.size_hint")}
                    </div>
                </div>
            )}

            {visibleFiles.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {t("pages.deals.workspace.files.empty")}
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
                            <div className="text-[12px] text-[#9ca3af]">
                                {file.sizeLabel} · {t("pages.deals.workspace.files.uploaded_label")}{" "}
                                {file.uploadedLabel}
                            </div>
                        </div>

                        <div className="flex shrink-0 gap-1.5">
                            <DealButton
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadDealFile(file.file)}
                                aria-label={t("pages.deals.workspace.files.download")}
                            >
                                <DealIcon name="external-link" size={13} />
                            </DealButton>
                            {canDeleteFile(file.file, permissions, userId) && (
                                <DealButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteFile(file.file)}
                                    aria-label={t("pages.deals.common.delete")}
                                >
                                    <DealIcon name="x" size={13} />
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
                skipReload
                onSuccess={() => {
                    const deletedId = deleteFile?.id;
                    setDeleteFile(null);
                    if (deletedId) {
                        setFiles((prev) =>
                            prev.filter((item) => item.id !== deletedId),
                        );
                    }
                }}
            />
        </>
    );
}

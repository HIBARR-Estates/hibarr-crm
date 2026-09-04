import { useMemo, useState } from "react";
import { Deferred, usePage } from "@inertiajs/react";
import axios from "axios";
import { message } from "antd";
import {
    AttachmentFileCard,
    CollapsibleGroup,
    ConfirmDialog,
    FileDropzone,
} from "@/Components/Redesign";
import type { PageProps } from "@/Components/DashboardLayout";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useDealFilesGroupingFlag from "@/Hooks/useDealFilesGroupingFlag";
import { isLoading } from "@/lib/utils";
import type { LeadContactFile } from "@/Types/api/file";
import type { CustomField } from "@/Types";
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
import useLeadCrossDealDocuments from "../../../hooks/useLeadCrossDealDocuments";
import useLeadDealDocumentUpload from "../../../hooks/useLeadDealDocumentUpload";
import useLeadFileUpload from "../../../hooks/useLeadFileUpload";

interface FilesTabProps {
    fields?: Array<{
        id: number;
        label?: string;
        name?: string;
        type?: string;
        show_rule_set?: CustomField["show_rule_set"];
    }>;
    editLeadPermission?: string;
}

/**
 * Lead Files tab — every file field shows exactly once here, lead-wide,
 * never one instance per deal: a plain lead-level field (useLeadDocuments)
 * plus every cross-deal field resolved to a single slot (a Lead field gated
 * by pipeline, or a Deal field opted into "Show in Lead" — both via
 * useLeadCrossDealDocuments), labelled with which deal it's sourced from.
 * "Other files" is the lead's own loose attachments only — a deal's loose
 * (non-custom-field) attachments stay on that deal's own Files tab, not
 * aggregated here.
 *
 * Behind crm.deal-files-grouping: deal-owned cross-populated fields move out
 * of "Lead documents" into their own "Deal files" section, one collapsible
 * group per deal, and the upload dropzone moves to the top of the tab. Off,
 * everything renders exactly as before (one flat "Lead documents" list,
 * dropzone below the slot sections).
 */
export default function FilesTab({
    fields = [],
    editLeadPermission,
}: FilesTabProps) {
    const { td } = useTd();
    const { props } = usePage<PageProps>();
    const userId = props.auth?.user?.id;
    const filesGroupingEnabled = useDealFilesGroupingFlag();
    const [deleteFile, setDeleteFile] = useState<LeadContactFile | null>(null);
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [replacingId, setReplacingId] = useState<number | null>(null);

    const { lead, deals, files, setFiles, filesLoading } = useLeadWorkspace();
    const canEdit = canEditLead(editLeadPermission, lead, userId);

    const handleRename = async (file: LeadContactFile, label: string) => {
        setRenamingId(file.id);
        try {
            const res = await axios.put(
                route("lead-contact-files.update", file.id),
                { description: label },
                { headers: { Accept: "application/json" } },
            );
            if (!res.data?.data) {
                message.error(res.data?.message || td("Could not rename file", { source: "en" }));
                // Rethrow so AttachmentFileCard keeps the editor open with the
                // typed draft intact instead of closing over a failed save.
                throw new Error("rename_failed");
            }

            setFiles((prev) =>
                prev.map((f) => (f.id === file.id ? { ...f, description: label } : f)),
            );
            message.success(td("File renamed", { source: "en" }));
        } catch (error: any) {
            if (error?.message !== "rename_failed") {
                message.error(
                    error?.response?.data?.message || td("Could not rename file", { source: "en" }),
                );
            }
            throw error;
        } finally {
            setRenamingId(null);
        }
    };

    const handleReplace = async (file: LeadContactFile, newFile: File) => {
        setReplacingId(file.id);
        try {
            const formData = new FormData();
            formData.append("_method", "PUT");
            formData.append("file", newFile);
            const res = await axios.post(
                route("lead-contact-files.update", file.id),
                formData,
                { headers: { Accept: "application/json" } },
            );
            if (!res.data?.data) {
                message.error(res.data?.message || td("Could not replace file", { source: "en" }));
                throw new Error("replace_failed");
            }

            setFiles((prev) =>
                prev.map((f) => (f.id === file.id ? { ...f, ...res.data.data } : f)),
            );
            message.success(td("File replaced", { source: "en" }));
        } catch (error: any) {
            if (error?.message !== "replace_failed") {
                message.error(
                    error?.response?.data?.message || td("Could not replace file", { source: "en" }),
                );
            }
            throw error;
        } finally {
            setReplacingId(null);
        }
    };

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

    // A Deal FILE field opted into "Show in Lead".
    const dealFileFields =
        (props.dealFileFields as Array<{
            id: number;
            label?: string;
            name?: string;
            type?: string;
        }> | undefined) ?? [];
    // Every cross-deal field (Lead-owned gated by pipeline, or Deal-owned
    // cross-populated) resolves to exactly ONE lead-wide slot — never one
    // per deal. A Lead-owned field's value is genuinely the lead's own (read
    // straight off `lead`); a Deal-owned field's value lives on whichever
    // deal useLeadCrossDealDocuments resolves it to. See that hook for
    // details.
    const crossDealSlots = useLeadCrossDealDocuments(deals, fields, lead, dealFileFields);
    const {
        uploadToSlot: uploadToDealSlot,
        deleteSlot: deleteDealSlot,
        isUploadingSlot: isUploadingDealSlot,
        isDeletingSlot: isDeletingDealSlot,
    } = useLeadDealDocumentUpload();
    // Behind crm.deal-files-grouping: split cross-deal slots into the ones
    // with no dealId (a lead-owned field, genuinely the lead's own — stays
    // alongside `slots`) and the ones with a dealId (a deal-owned field
    // cross-populated here), grouped by that deal so the Files tab can show
    // a dedicated "Deal files" section with one collapsible group per deal
    // instead of one flat mixed list. Flag off keeps the original flat
    // combination, unchanged.
    const { leadOwnedCrossSlots, dealFileGroups } = useMemo(() => {
        const leadOwned: typeof crossDealSlots = [];
        const groupsByDealId = new Map<
            number,
            { dealId: number; dealName?: string; docs: typeof crossDealSlots }
        >();

        for (const doc of crossDealSlots) {
            if (doc.dealId == null) {
                leadOwned.push(doc);
                continue;
            }
            const existing = groupsByDealId.get(doc.dealId);
            if (existing) {
                existing.docs.push(doc);
            } else {
                groupsByDealId.set(doc.dealId, {
                    dealId: doc.dealId,
                    dealName: doc.dealName,
                    docs: [doc],
                });
            }
        }

        return {
            leadOwnedCrossSlots: leadOwned,
            dealFileGroups: Array.from(groupsByDealId.values()),
        };
    }, [crossDealSlots]);

    // Combined so the "Lead documents" section reads as one flat list — a
    // cross-populated Deal field is, from here, indistinguishable from a
    // genuine lead-owned field except for which deal an edit targets
    // (doc.dealId), which the row-level onUpload/onDelete below branch on.
    // Flag on: deal-owned fields move to their own grouped section instead.
    const leadLevelSlots = useMemo(
        () => [...slots, ...(filesGroupingEnabled ? leadOwnedCrossSlots : crossDealSlots)],
        [slots, filesGroupingEnabled, leadOwnedCrossSlots, crossDealSlots],
    );

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

    const hasDocumentSlots =
        leadLevelSlots.length > 0 ||
        (filesGroupingEnabled && dealFileGroups.length > 0);

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
                message.success(td("File deleted", { source: "en" }));
            },
            onError: () => {
                message.error(td("Could not delete file", { source: "en" }));
            },
        });
    };

    // A cross-populated Deal field (see useLeadCrossDealDocuments) carries
    // dealId — its value lives on that specific deal, so edits must route
    // through the deal upload path instead of the lead's own.
    const renderDocRow = (doc: (typeof leadLevelSlots)[number]) => {
        const targetDealId = doc.dealId;
        return (
            <DealDocumentSlotRow
                key={doc.id}
                doc={doc as unknown as DealDocumentItem}
                variant="full"
                onUpload={(slot, file) =>
                    targetDealId != null
                        ? uploadToDealSlot(targetDealId, slot as unknown as typeof doc, file)
                        : uploadToSlot(slot as unknown as typeof doc, file)
                }
                onDelete={(slot) =>
                    targetDealId != null
                        ? deleteDealSlot(targetDealId, slot as unknown as typeof doc)
                        : deleteSlot(slot as unknown as typeof doc)
                }
                uploading={
                    targetDealId != null
                        ? isUploadingDealSlot(targetDealId, doc.fieldName)
                        : isUploadingField(doc.fieldName)
                }
                deleting={
                    targetDealId != null
                        ? isDeletingDealSlot(targetDealId, doc.fieldName)
                        : isDeletingField(doc.fieldName)
                }
                disabled={!canEditFields}
            />
        );
    };

    const dropzone = canEdit ? (
        <FileDropzone
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            dropHint={td("Drop files here or click to upload", { source: "en" })}
            uploadingLabel={td("Uploading", { source: "en" })}
            sizeHint={td("PDF, images, ZIP — max 200 MB", { source: "en" })}
            onFilesSelected={(fileList) => {
                void handleFilesSelected(fileList);
            }}
        />
    ) : null;

    return (
        <div>
            {filesGroupingEnabled && dropzone}

            {leadLevelSlots.length > 0 ? (
                <section className="mb-5">
                    <div className="mb-1 text-[14px] font-bold text-[#1a1f2e]">
                        {td("Lead documents", { source: "en" })}
                    </div>
                    <div className="mb-2 text-[12px] text-[#9ca3af]">
                        {td("Required or optional file fields for this lead. Upload each into its slot.", { source: "en" })}
                    </div>
                    <div className="rounded-lg border border-[#e2e5ea] bg-white px-3.5">
                        {leadLevelSlots.map(renderDocRow)}
                    </div>
                </section>
            ) : null}

            {filesGroupingEnabled ? (
                // dealFileFields is an Inertia::defer prop (LeadContactController)
                // — render a placeholder while it loads rather than letting the
                // `?? []` fallback silently present "no deal files" as settled.
                <Deferred
                    data="dealFileFields"
                    fallback={
                        <section className="mb-5">
                            <div className="mb-1 text-[14px] font-bold text-[#1a1f2e]">
                                {td("Deal files", { source: "en" })}
                            </div>
                            <div className="h-16 animate-pulse rounded-lg border border-[#e2e5ea] bg-[#f6f7f9]" />
                        </section>
                    }
                >
                    {dealFileGroups.length > 0 ? (
                <section className="mb-5">
                    <div className="mb-1 text-[14px] font-bold text-[#1a1f2e]">
                        {td("Deal files", { source: "en" })}
                    </div>
                    <div className="mb-2 text-[12px] text-[#9ca3af]">
                        {td("Files from this lead's deals, grouped by deal.", { source: "en" })}
                    </div>
                    <div className="rounded-lg border border-[#e2e5ea] bg-white px-3.5">
                        {dealFileGroups.map((group) => (
                            <CollapsibleGroup
                                key={group.dealId}
                                title={group.dealName ?? td("Deal", { source: "en" })}
                                summary={`${group.docs.filter((d) => d.uploaded).length}/${group.docs.length}`}
                            >
                                {group.docs.map(renderDocRow)}
                            </CollapsibleGroup>
                        ))}
                    </div>
                </section>
                    ) : null}
                </Deferred>
            ) : null}

            {hasDocumentSlots ? (
                <div className="mb-2 text-[14px] font-bold text-[#1a1f2e]">
                    {td("Other files", { source: "en" })}
                </div>
            ) : null}

            {!filesGroupingEnabled && dropzone}

            {filesLoading ? (
                <p className="px-1 text-[13px] text-[#9ca3af]">
                    {td("Loading files…", { source: "en" })}
                </p>
            ) : visibleFiles.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {td("No files uploaded", { source: "en" })}
                </p>
            ) : (
                visibleFiles.map((file) => (
                    <AttachmentFileCard
                        key={`lead-${file.id}`}
                        name={file.name}
                        sizeLabel={file.sizeLabel}
                        uploadedLabel={file.uploadedLabel}
                        uploadedPrefix={td("Uploaded", { source: "en" })}
                        iconName={file.iconName}
                        downloadLabel={td("Download", { source: "en" })}
                        deleteLabel={td("Delete", { source: "en" })}
                        onDownload={() => downloadLeadContactFile(file.file)}
                        onDelete={
                            canEdit
                                ? () => setDeleteFile(file.file)
                                : undefined
                        }
                        onRename={
                            canEdit
                                ? (label) => handleRename(file.file, label)
                                : undefined
                        }
                        renameLabel={td("Rename", { source: "en" })}
                        renameSaveLabel={td("Save", { source: "en" })}
                        renameCancelLabel={td("Cancel", { source: "en" })}
                        renamePlaceholder={td("File label", { source: "en" })}
                        renaming={renamingId === file.file.id}
                        onReplace={
                            canEdit
                                ? (newFile) => handleReplace(file.file, newFile)
                                : undefined
                        }
                        replaceLabel={td("Replace", { source: "en" })}
                        replacing={replacingId === file.file.id}
                    />
                ))
            )}

            <ConfirmDialog
                open={Boolean(deleteFile)}
                title={td("Delete file", { source: "en" })}
                message={
                    deleteFile
                        ? td(`Are you sure you want to delete ${deleteFile.filename}? This cannot be undone.`, { source: "en" })
                        : td("Delete this file?", { source: "en" })
                }
                confirmLabel={td("Delete", { source: "en" })}
                cancelLabel={td("Cancel", { source: "en" })}
                danger
                confirmLoading={isLoading({ status: destroyStatus })}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteFile(null)}
            />
        </div>
    );
}

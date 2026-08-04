import { useRef, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { DealDocumentItem } from "../../hooks/useDealDocuments";
import DealIcon from "../primitives/DealIcon";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealDocumentSlotRowProps {
    doc: DealDocumentItem;
    /** Uploads the picked file into this slot's field. */
    onUpload: (doc: DealDocumentItem, file: File) => void;
    /** Clears the stored file from this slot's field. Omit to hide delete entirely. */
    onDelete?: (doc: DealDocumentItem) => void | Promise<void>;
    uploading?: boolean;
    deleting?: boolean;
    disabled?: boolean;
    /** `compact` is the dossier rail; `full` is the Files tab. */
    variant?: "compact" | "full";
}

/**
 * One document slot. An empty slot uploads on click; an uploaded slot with a
 * resolvable file opens it (view/download) on click instead — replacing and
 * deleting are available via explicit actions, gated by the same `disabled`
 * (deal edit permission) as upload.
 */
export default function DealDocumentSlotRow({
    doc,
    onUpload,
    onDelete,
    uploading = false,
    deleting = false,
    disabled = false,
    variant = "compact",
}: DealDocumentSlotRowProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const inputRef = useRef<HTMLInputElement>(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const isFull = variant === "full";
    const busy = uploading || deleting;
    const canUpload = Boolean(doc.fieldName) && !disabled && !busy;
    const canDelete = Boolean(onDelete) && !disabled && !busy;
    // When a file is actually stored (and viewable), clicking opens it rather
    // than prompting another upload.
    const openHref = doc.uploaded ? doc.fileUrl : undefined;

    const confirmDialog = onDelete ? (
        <DealConfirmDialog
            open={confirmingDelete}
            title={t("pages.deals.workspace.documents.delete_confirm_title")}
            message={t("pages.deals.workspace.documents.delete_confirm_message")}
            confirmLabel={t("pages.deals.common.delete")}
            cancelLabel={t("pages.deals.common.cancel")}
            danger
            confirmLoading={deleting}
            onConfirm={async () => {
                await onDelete(doc);
                setConfirmingDelete(false);
            }}
            onCancel={() => setConfirmingDelete(false)}
        />
    ) : null;

    const statusLabel = uploading
        ? t("pages.deals.workspace.files.uploading")
        : doc.uploaded
          ? t("pages.deals.workspace.documents.replace")
          : t("pages.deals.workspace.documents.upload");

    const pillClass = uploading
        ? "dr-pill-blue"
        : doc.uploaded
          ? "dr-pill-green"
          : "dr-pill-gray";
    const pillLabel = uploading
        ? t("pages.deals.workspace.files.uploading")
        : doc.uploaded
          ? t("pages.deals.workspace.documents.uploaded")
          : t("pages.deals.workspace.documents.missing");

    const fileInput = (
        <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(doc, file);
                event.target.value = "";
            }}
        />
    );

    // Compact (dossier rail) is only ~270px wide, so the whole row is the
    // click target and carries nothing but icon + label + status. Anything
    // more overflows and gives the rail a sideways scrollbar — the click
    // hint below is added as a second line (height, not width) to stay
    // inside that constraint.
    const clickHint = doc.uploaded
        ? t("pages.deals.workspace.documents.click_to_view")
        : t("pages.deals.workspace.documents.click_to_upload");

    if (!isFull) {
        const inner = (
            <>
                <DealIcon
                    name="file-text"
                    size={13}
                    color={doc.uploaded ? T.GREEN : T.TEXT_MUTED}
                />
                <span className="min-w-0 flex-1">
                    <span
                        className="block truncate"
                        style={{ fontSize: 12, color: T.TEXT }}
                    >
                        {td(doc.label)}
                    </span>
                    <span
                        className="block truncate"
                        style={{ fontSize: 11, color: T.TEXT_MUTED }}
                    >
                        {clickHint}
                    </span>
                </span>
                <span className={`dr-pill ${pillClass}`} style={{ flexShrink: 0 }}>
                    {pillLabel}
                </span>
            </>
        );
        const rowClass =
            "flex min-w-0 flex-1 items-center gap-2 border-none bg-transparent px-0 py-2.5 text-left no-underline";

        return (
            <div className="w-full min-w-0 border-b border-[#eef0f3] last:border-b-0">
                {fileInput}
                <div className="flex w-full min-w-0 items-center gap-1">
                    {openHref ? (
                        <a
                            href={openHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${doc.label} — ${t("pages.deals.workspace.documents.open")}`}
                            className={rowClass}
                            style={{ cursor: "pointer" }}
                        >
                            {inner}
                        </a>
                    ) : (
                        <button
                            type="button"
                            disabled={!canUpload}
                            onClick={() => inputRef.current?.click()}
                            title={`${doc.label} — ${statusLabel}`}
                            className={rowClass}
                            style={{ cursor: canUpload ? "pointer" : "default" }}
                        >
                            {inner}
                        </button>
                    )}
                    {doc.uploaded && canDelete && (
                        <button
                            type="button"
                            onClick={() => setConfirmingDelete(true)}
                            title={`${doc.label} — ${t("pages.deals.common.delete")}`}
                            className="shrink-0 cursor-pointer border-none bg-transparent p-0.5"
                            style={{ color: T.RED }}
                        >
                            <DealIcon name="trash" size={12} />
                        </button>
                    )}
                </div>
                {confirmDialog}
            </div>
        );
    }

    return (
        <div
            className="flex min-w-0 items-center gap-2.5 border-b border-[#eef0f3] last:border-b-0"
            style={{ padding: "12px 2px" }}
        >
            {fileInput}

            {/* Uploaded + viewable → open file. Empty → click tile to upload. */}
            {openHref ? (
                <a
                    href={openHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("pages.deals.workspace.documents.open")}
                    className="flex min-w-0 flex-1 items-center gap-2.5 no-underline"
                >
                    <DealIcon name="file-text" size={17} color={T.GREEN} />
                    <span className="min-w-0 flex-1">
                        <span
                            className="flex items-center gap-1.5 truncate"
                            style={{ fontSize: 14, color: T.BLUE }}
                        >
                            <span className="truncate">{td(doc.label)}</span>
                            <DealIcon name="external-link" size={13} />
                        </span>
                        <span
                            className="block truncate"
                            style={{ fontSize: 11, color: T.TEXT_MUTED }}
                        >
                            {clickHint}
                        </span>
                    </span>
                </a>
            ) : (
                <button
                    type="button"
                    disabled={!canUpload}
                    onClick={() => inputRef.current?.click()}
                    title={`${doc.label} — ${statusLabel}`}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left"
                    style={{ cursor: canUpload ? "pointer" : "default" }}
                >
                    <DealIcon name="file-text" size={17} color={T.TEXT_MUTED} />
                    <span className="min-w-0 flex-1">
                        <span
                            className="block truncate"
                            style={{ fontSize: 14, color: T.TEXT }}
                        >
                            {td(doc.label)}
                        </span>
                        <span
                            className="block truncate"
                            style={{ fontSize: 11, color: T.TEXT_MUTED }}
                        >
                            {clickHint}
                        </span>
                    </span>
                </button>
            )}

            <span
                className={`dr-pill ${uploading ? "dr-pill-blue" : doc.uploaded ? "dr-pill-green" : "dr-pill-gray"}`}
                style={{ flexShrink: 0 }}
            >
                {pillLabel}
            </span>

            {canUpload && (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-semibold"
                    style={{ fontSize: 13, color: T.BLUE }}
                >
                    {statusLabel}
                </button>
            )}
            {doc.uploaded && canDelete && (
                <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-semibold"
                    style={{ fontSize: 13, color: T.RED }}
                >
                    {t("pages.deals.common.delete")}
                </button>
            )}
            {confirmDialog}
        </div>
    );
}

import { useRef } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { DealDocumentItem } from "../../hooks/useDealDocuments";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealDocumentSlotRowProps {
    doc: DealDocumentItem;
    /** Uploads the picked file into this slot's field. */
    onUpload: (doc: DealDocumentItem, file: File) => void;
    uploading?: boolean;
    disabled?: boolean;
    /** `compact` is the dossier rail; `full` is the Files tab. */
    variant?: "compact" | "full";
}

/**
 * One document slot. An empty slot uploads on click; an uploaded slot with a
 * resolvable file opens it (view/download) on click instead — replacing is
 * still available via the explicit "Replace" action in the full variant.
 */
export default function DealDocumentSlotRow({
    doc,
    onUpload,
    uploading = false,
    disabled = false,
    variant = "compact",
}: DealDocumentSlotRowProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const inputRef = useRef<HTMLInputElement>(null);
    const isFull = variant === "full";
    const canUpload = Boolean(doc.fieldName) && !disabled && !uploading;
    // When a file is actually stored (and viewable), clicking opens it rather
    // than prompting another upload.
    const openHref = doc.uploaded ? doc.fileUrl : undefined;

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
    // more overflows and gives the rail a sideways scrollbar.
    if (!isFull) {
        const inner = (
            <>
                <DealIcon
                    name="file-text"
                    size={13}
                    color={doc.uploaded ? T.GREEN : T.TEXT_MUTED}
                />
                <span
                    className="min-w-0 flex-1 truncate"
                    style={{ fontSize: 12, color: T.TEXT }}
                >
                    {td(doc.label)}
                </span>
                <span className={`dr-pill ${pillClass}`} style={{ flexShrink: 0 }}>
                    {pillLabel}
                </span>
            </>
        );
        const rowClass =
            "flex w-full min-w-0 items-center gap-2 border-none bg-transparent px-0 py-2.5 text-left no-underline";

        return (
            <div className="w-full min-w-0 border-b border-[#eef0f3] last:border-b-0">
                {fileInput}
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
            </div>
        );
    }

    return (
        <div
            className="flex min-w-0 items-center gap-2.5 border-b border-[#eef0f3] last:border-b-0"
            style={{ padding: "12px 2px" }}
        >
            {fileInput}

            <DealIcon
                name="file-text"
                size={17}
                color={doc.uploaded ? T.GREEN : T.TEXT_MUTED}
            />

            {/* Uploaded + viewable → the label itself opens the file. */}
            {openHref ? (
                <a
                    href={openHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("pages.deals.workspace.documents.open")}
                    className="flex min-w-0 flex-1 items-center gap-1.5 truncate no-underline"
                    style={{ fontSize: 14, color: T.BLUE }}
                >
                    <span className="truncate">{td(doc.label)}</span>
                    <DealIcon name="external-link" size={13} />
                </a>
            ) : (
                <span
                    className="min-w-0 flex-1 truncate"
                    style={{ fontSize: 14, color: T.TEXT }}
                    title={doc.label}
                >
                    {td(doc.label)}
                </span>
            )}

            <span
                className={`dr-pill ${doc.uploaded ? "dr-pill-green" : "dr-pill-gray"}`}
                style={{ flexShrink: 0 }}
            >
                {doc.uploaded
                    ? t("pages.deals.workspace.documents.uploaded")
                    : t("pages.deals.workspace.documents.missing")}
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
            {uploading && (
                <span
                    className="shrink-0 font-semibold"
                    style={{ fontSize: 13, color: T.TEXT_MUTED }}
                >
                    {statusLabel}…
                </span>
            )}
        </div>
    );
}

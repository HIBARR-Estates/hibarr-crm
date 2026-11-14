import { useMemo, useRef } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { downloadDealFile, toWorkspaceFilePreview } from "@/Pages/Deals/Redesign/adapters/fileAdapter";
import useDealFileUpload from "@/Pages/Deals/Redesign/hooks/useDealFileUpload";
import type { DealDocumentItem } from "@/Pages/Deals/Redesign/hooks/useDealDocuments";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import SectionCard, { SectionEmpty, SectionSkeleton } from "./SectionCard";

interface FilesSectionProps {
    deal: Deal;
    /** useDealDocuments: the deal's document fields and loose files; only uploaded ones are listed. */
    documents: DealDocumentItem[];
    files: DealFile[];
    loading: boolean;
    /** add_lead_files, as the classic Files tab reads it. */
    canUpload: boolean;
    /** Replaces "Files" (the deal-only view reads "Files on this deal"). */
    title?: string;
}

/** Type badge colours of the board: PDF red, images blue, documents navy. */
function badgeFor(name: string): { label: string; tone: "pdf" | "image" | "doc" } {
    const extension = (name.split(".").pop() ?? "").toLowerCase();
    if (extension === "pdf") return { label: "PDF", tone: "pdf" };
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(extension)) {
        return { label: extension === "jpeg" ? "JPG" : extension.toUpperCase(), tone: "image" };
    }
    return { label: /^[a-z0-9]{1,4}$/.test(extension) && extension !== name.toLowerCase() ? extension.toUpperCase() : "FILE", tone: "doc" };
}

/**
 * The deal's files: its uploaded document fields and loose attachments, as a
 * type badge, the name and where it came from. Upload adds loose files; the
 * document fields themselves are filled from Deal details.
 */
export default function FilesSection({ deal, documents, files, loading, canUpload, title }: FilesSectionProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const input = useRef<HTMLInputElement>(null);
    const { uploadFiles, isUploading } = useDealFileUpload(deal.id);
    const uploaded = useMemo(() => documents.filter((doc) => doc.uploaded), [documents]);
    const byId = useMemo(() => new Map(files.map((file) => [`file-${file.id}`, file])), [files]);

    return (
        <SectionCard
            id="deal-files"
            title={
                <>
                    {title ?? t("pages.agent_workspace.deal.files.title")}
                    {uploaded.length > 0 ? <span className="agent-card__count"> · {uploaded.length}</span> : null}
                </>
            }
            action={
                canUpload ? (
                    <>
                        <input
                            ref={input}
                            type="file"
                            multiple
                            hidden
                            onChange={async (event) => {
                                const selected = Array.from(event.target.files ?? []);
                                event.target.value = "";
                                if (selected.length > 0) await uploadFiles(selected);
                            }}
                        />
                        <Button size="sm" className="agent-btn-soft" loading={isUploading} onClick={() => input.current?.click()}>
                            <Icon name="plus" size={12} />
                            {t("pages.agent_workspace.deal.files.upload")}
                        </Button>
                    </>
                ) : null
            }
        >
            {loading && files.length === 0 ? (
                <SectionSkeleton />
            ) : uploaded.length === 0 ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.files.empty")}</SectionEmpty>
            ) : (
                <ul className="agent-deal__rows">
                    {uploaded.map((doc) => {
                        const file = byId.get(doc.id);
                        const preview = file ? toWorkspaceFilePreview(file) : null;
                        const badge = badgeFor(file?.filename ?? doc.fileUrl ?? doc.label);
                        const sub = preview
                            ? [preview.sizeLabel, preview.uploadedLabel].join(" · ")
                            : doc.source === "lead"
                              ? t("pages.agent_workspace.deal.files.personal")
                              : t("pages.agent_workspace.deal.files.document");
                        const open = () => {
                            if (file) downloadDealFile(file);
                            else if (doc.fileUrl) window.open(doc.fileUrl, "_blank", "noreferrer");
                        };
                        return (
                            <li key={doc.id}>
                                <button
                                    type="button"
                                    className="agent-deal__row agent-deal__row--file"
                                    onClick={open}
                                    disabled={!file && !doc.fileUrl}
                                >
                                    <span className={`agent-deal__badge agent-deal__badge--${badge.tone}`} aria-hidden="true">
                                        {badge.label}
                                    </span>
                                    <span className="agent-deal__row-body">
                                        <span className="agent-deal__row-title">{doc.source === "attachment" ? doc.label : td(doc.label, { source: "en" })}</span>
                                        <span className="agent-deal__row-sub">{sub}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
}

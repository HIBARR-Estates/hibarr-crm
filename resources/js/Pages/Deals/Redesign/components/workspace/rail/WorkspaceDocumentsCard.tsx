import { useTd } from "@/Hooks/useDynamicTranslation";
import DealBadge from "../../primitives/DealBadge";
import DealIcon from "../../primitives/DealIcon";
import DealPanelHeader from "../../primitives/DealPanelHeader";
import type { DealDocumentItem } from "../../../hooks/useDealDocuments";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

interface WorkspaceDocumentsCardProps {
    documents: DealDocumentItem[];
    uploadedCount: number;
    totalCount: number;
    onOpenFiles: () => void;
}

export default function WorkspaceDocumentsCard({
    documents,
    uploadedCount,
    totalCount,
    onOpenFiles,
}: WorkspaceDocumentsCardProps) {
    const { td } = useTd();

    return (
        <section className="mb-3 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
            <DealPanelHeader
                title={td("Documents & files")}
                rightSlot={
                    <span className="text-[11px] text-white/85">
                        {uploadedCount}/{totalCount}
                    </span>
                }
            />
            <div>
                {documents.length === 0 ? (
                    <p className="px-[13px] py-3 text-[13px] italic text-[#9ca3af]">
                        {td("No document slots configured.")}
                    </p>
                ) : (
                    documents.map((document) => (
                        <button
                            key={document.id}
                            type="button"
                            onClick={onOpenFiles}
                            className="flex w-full items-center justify-between border-b border-[#e2e5ea] px-[13px] py-2.5 text-left last:border-b-0 hover:bg-[#f9fafb]"
                        >
                            <span className="flex items-center gap-1.5 text-xs text-[#1a1f2e]">
                                <DealIcon
                                    name="file-text"
                                    size={13}
                                    color={
                                        document.uploaded ? T.GREEN : T.TEXT_HINT
                                    }
                                />
                                {document.label}
                            </span>
                            <DealBadge variant={document.uploaded ? "green" : "gray"}>
                                {document.uploaded ? td("Uploaded") : td("Missing")}
                            </DealBadge>
                        </button>
                    ))
                )}
            </div>
        </section>
    );
}

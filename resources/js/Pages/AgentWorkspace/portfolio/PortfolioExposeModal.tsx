import { lazy, Suspense } from "react";
import useExposeShareLinksFlag from "@/Hooks/useExposeShareLinksFlag";

const ShareExposeLinkModal = lazy(() => import("@/Features/Expose/ShareExposeLinkModal"));
const GenerateExposeModal = lazy(() => import("@/Features/Properties/GenerateExposeModal"));

export interface ExposeTarget {
    kind: "property" | "developer_project";
    id: number;
    title: string;
    subtitle?: string;
    /** Set when the exposé is for a deal's contact, so the modal does not ask who. */
    leadId?: number;
    leadLabel?: string;
}

/**
 * The Properties and Projects pages' own exposé dialogs, opened from a card.
 * The share-link dialog when the company has it, else the PDF generator
 * (properties only). Loaded the first time an Exposé button is pressed.
 */
export default function PortfolioExposeModal({ target, onClose }: { target: ExposeTarget; onClose: () => void }) {
    const shareLinks = useExposeShareLinksFlag();

    return (
        <Suspense fallback={null}>
            {shareLinks ? (
                <ShareExposeLinkModal
                    open
                    onClose={onClose}
                    entityType={target.kind}
                    entityId={target.id}
                    title={target.title}
                    subtitle={target.subtitle}
                    leadId={target.leadId}
                    leadLabel={target.leadLabel}
                />
            ) : target.kind === "property" ? (
                <GenerateExposeModal open onClose={onClose} propertyId={target.id} projectName={target.subtitle} unitName={target.title} />
            ) : null}
        </Suspense>
    );
}

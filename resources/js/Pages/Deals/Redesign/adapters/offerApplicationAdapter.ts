import type { DealOfferApplication } from "@/Types/api/offers";

export interface WorkspaceOfferApplicationItem {
    id: number;
    offerName: string;
    propertyLabel: string;
    offerType: DealOfferApplication["offer_type"];
    offerValueLabel: string;
    originalAmount: number;
    discountAmount: number;
}

function formatOfferValue(application: DealOfferApplication): string {
    if (application.offer_type === "percentage") {
        return `${application.offer_value}%`;
    }
    return String(application.offer_value);
}

export function toWorkspaceOfferApplicationItem(
    application: DealOfferApplication,
): WorkspaceOfferApplicationItem {
    const propertyLabel =
        application.product?.property?.title ||
        application.product?.name ||
        `Product #${application.product_id}`;

    return {
        id: application.id,
        offerName: application.offer?.name || `Offer #${application.offer_id}`,
        propertyLabel,
        offerType: application.offer_type,
        offerValueLabel: formatOfferValue(application),
        originalAmount: application.original_amount,
        discountAmount: application.discount_amount,
    };
}

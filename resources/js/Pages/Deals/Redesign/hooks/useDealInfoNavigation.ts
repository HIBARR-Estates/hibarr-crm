import { useMemo } from "react";
import type { Deal } from "@/Types/api/deals";
import {
    buildCoreNavItem,
    CORE_SECTION_FIELD_LABELS,
    DEAL_INFO_CORE_SECTION_ORDER,
    DEAL_INFO_NOW_SECTION_COUNT,
    getCategoriesForCoreSection,
    getUnmappedCategories,
    toCategorySectionId,
} from "../config/dealInfoSections";
import type { DealInfoCoreSectionId, DealInfoSectionId } from "../types";

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
    custom_field_category_id?: string | number;
    required?: boolean | string;
}

interface NavGroup {
    label: string;
    items: Array<{
        id: DealInfoSectionId;
        label: string;
        icon: string;
        badge?: string;
        badgeVariant: "blue" | "gray";
        later?: boolean;
        /** Field labels inside the section, matched by the sidebar search. */
        searchTerms?: string[];
    }>;
}

function isFilledValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "boolean") return value === true;
    if (typeof value === "number") return true;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as object).length > 0;
    return Boolean(value);
}

function getCustomFieldValue(
    deal: Deal,
    fieldId: number,
): unknown {
    return (
        deal.custom_fields_data?.[`field_${fieldId}`] ??
        deal.custom_fields_data?.[fieldId]
    );
}

function getHibarrValue(deal: Deal, key: string): unknown {
    return deal.hibarr_fields?.[key as keyof NonNullable<Deal["hibarr_fields"]>];
}

function countSectionCompletion(
    sectionId: DealInfoCoreSectionId,
    deal: Deal,
    fields: CustomFieldDefinition[],
    categories: Array<{ id: number; name: string }>,
): { filled: number; total: number } {
    const categoryIds = getCategoriesForCoreSection(sectionId, categories).map(
        (category) => category.id,
    );
    const categoryFields = fields.filter((field) =>
        categoryIds.includes(Number(field.custom_field_category_id)),
    );

    const hibarrKeysBySection: Partial<Record<DealInfoCoreSectionId, string[]>> = {
        general: ["interested_in", "budget_range"],
        preftimeline: [
            "purchase_timeline",
            "motivation",
            "strategy_meeting_booked",
            "downpayment_paid",
            "inspection_trip_date",
        ],
        funding: [
            "deposit_confirmation",
            "reservation_agreement",
            "sales_contract",
        ],
        support: ["message"],
    };

    const dealKeysBySection: Partial<Record<DealInfoCoreSectionId, string[]>> = {
        general: ["name", "close_date", "category_id", "products"],
    };

    let filled = 0;
    let total = 0;

    const track = (value: unknown) => {
        total += 1;
        if (isFilledValue(value)) filled += 1;
    };

    if (sectionId === "contact") {
        track(deal.contact?.client_name ?? deal.contact?.client_name_salutation);
        track(deal.contact?.client_email);
        track(deal.contact?.mobile ?? deal.contact?.cell);
        track(deal.contact?.company_name);
        return { filled, total };
    }

    for (const key of dealKeysBySection[sectionId] ?? []) {
        if (key === "products") {
            track(deal.products?.length ? deal.products : null);
            continue;
        }
        track((deal as unknown as Record<string, unknown>)[key]);
    }

    for (const key of hibarrKeysBySection[sectionId] ?? []) {
        track(getHibarrValue(deal, key));
    }

    if (sectionId === "support") {
        track(deal.lead_agent?.user_id ?? deal.agent_id);
        track(deal.deal_participants?.length ? deal.deal_participants : null);
        track(deal.deal_watchers?.length ? deal.deal_watchers : null);
    }

    for (const field of categoryFields) {
        if (field.type === "file") continue;
        track(getCustomFieldValue(deal, field.id));
    }

    return { filled, total };
}

function countCategoryCompletion(
    categoryId: number,
    deal: Deal,
    fields: CustomFieldDefinition[],
): { filled: number; total: number } {
    const categoryFields = fields.filter(
        (field) => Number(field.custom_field_category_id) === categoryId,
    );
    let filled = 0;
    let total = 0;

    for (const field of categoryFields) {
        if (field.type === "file") continue;
        total += 1;
        if (isFilledValue(getCustomFieldValue(deal, field.id))) {
            filled += 1;
        }
    }

    return { filled, total };
}

export default function useDealInfoNavigation(
    deal: Deal,
    fields: CustomFieldDefinition[] = [],
    customFieldCategories: Array<{ id: number; name: string }> = [],
) {
    return useMemo(() => {
        const nowSections = DEAL_INFO_CORE_SECTION_ORDER.slice(
            0,
            DEAL_INFO_NOW_SECTION_COUNT,
        );
        const laterCoreSections = DEAL_INFO_CORE_SECTION_ORDER.slice(
            DEAL_INFO_NOW_SECTION_COUNT,
        );
        const unmappedCategories = getUnmappedCategories(customFieldCategories);

        const coreSearchTerms = (
            sectionId: (typeof DEAL_INFO_CORE_SECTION_ORDER)[number],
        ) => [
            ...(CORE_SECTION_FIELD_LABELS[sectionId] ?? []),
            ...getCategoriesForCoreSection(sectionId, customFieldCategories)
                .flatMap((category) =>
                    fields
                        .filter(
                            (field) =>
                                Number(field.custom_field_category_id) ===
                                category.id,
                        )
                        .map((field) => field.label ?? field.name ?? ""),
                )
                .filter(Boolean),
        ];

        const categorySearchTerms = (categoryId: number) =>
            fields
                .filter(
                    (field) =>
                        Number(field.custom_field_category_id) === categoryId,
                )
                .map((field) => field.label ?? field.name ?? "")
                .filter(Boolean);

        const nowItems = nowSections.map((sectionId) => {
            const { filled, total } = countSectionCompletion(
                sectionId,
                deal,
                fields,
                customFieldCategories,
            );
            const item = buildCoreNavItem(sectionId, false);
            return {
                ...item,
                badge: total > 0 ? `${filled}/${total}` : "--",
                searchTerms: coreSearchTerms(sectionId),
            };
        });

        const laterItems = [
            ...laterCoreSections.map((sectionId) => {
                const { filled, total } = countSectionCompletion(
                    sectionId,
                    deal,
                    fields,
                    customFieldCategories,
                );
                const item = buildCoreNavItem(sectionId, true);
                return {
                    ...item,
                    badge:
                        item.stageBadge ??
                        (total > 0 ? `${filled}/${total}` : "--"),
                    searchTerms: coreSearchTerms(sectionId),
                };
            }),
            ...unmappedCategories.map((category) => {
                const { filled, total } = countCategoryCompletion(
                    category.id,
                    deal,
                    fields,
                );
                return {
                    id: toCategorySectionId(category.id),
                    label: category.name,
                    icon: "layers",
                    badge: total > 0 ? `${filled}/${total}` : "--",
                    badgeVariant: "gray" as const,
                    later: true,
                    searchTerms: categorySearchTerms(category.id),
                };
            }),
            // v2.2 places GDPR & consents as the very last nav item.
            {
                ...buildCoreNavItem("gdpr", true),
                badge: undefined,
                searchTerms: CORE_SECTION_FIELD_LABELS.gdpr ?? [],
            },
        ];

        const navGroups: NavGroup[] = [
            { label: "Now — in progress", items: nowItems },
            { label: "Later stages", items: laterItems },
        ];

        return { navGroups };
    }, [customFieldCategories, deal, fields]);
}

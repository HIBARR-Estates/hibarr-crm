import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

/**
 * Attaching a recommended property to a deal.
 *
 * A deal holds `products`, and a Property is reached through `product.property`
 * (Property.product_id). Recommendations carry a *property* id, so attaching
 * goes through `deals.properties.store`, which resolves (or creates) the
 * backing Product, guards duplicates, records the activity event and
 * recalculates the deal value. Do not sync product ids with a property id —
 * they are different entities.
 */
export default function useDealRecommendationAdd(deal: Deal) {
    const [addingPropertyIds, setAddingPropertyIds] = useState<Set<number>>(
        new Set(),
    );
    const { setDeal } = useDealWorkspace();
    const { t } = useTranslation();

    /** Property ids already on the deal, read through each product. */
    const existingPropertyIds = useMemo(
        () =>
            (deal.products ?? [])
                .map((product) => product.property?.id)
                .filter((id): id is number => typeof id === "number"),
        [deal.products],
    );

    const isPropertyAdding = useCallback(
        (propertyId: number | null): boolean => {
            if (!propertyId) return false;
            return addingPropertyIds.has(propertyId);
        },
        [addingPropertyIds],
    );

    const isPropertyInDeal = useCallback(
        (propertyId: number | null): boolean => {
            if (!propertyId) return false;
            return existingPropertyIds.includes(propertyId);
        },
        [existingPropertyIds],
    );

    const addPropertiesToDeal = useCallback(
        async (propertyIds: number[]) => {
            if (propertyIds.length === 0) return;

            setAddingPropertyIds(
                (previous) => new Set([...previous, ...propertyIds]),
            );

            try {
                const failures: string[] = [];

                for (const propertyId of propertyIds) {
                    const response = await axios.post(
                        route("deals.properties.store", deal.id),
                        { property_id: propertyId },
                        { headers: { Accept: "application/json" } },
                    );

                    if (response.data?.status !== "success") {
                        failures.push(
                            response.data?.message ||
                                t(
                                    "pages.deals.workspace.recommendations.messages.add_failed",
                                ),
                        );
                    }
                }

                // The attach endpoint returns only a status, so pull the deal
                // back down to refresh products / value / offers.
                const refreshed = await axios.get(
                    route("deals.refresh", deal.id),
                );
                if (
                    refreshed.data?.status === "success" &&
                    refreshed.data?.data
                ) {
                    setDeal(refreshed.data.data);
                }

                if (failures.length > 0) {
                    message.error(failures[0]);
                    return;
                }

                message.success(
                    t("pages.deals.workspace.recommendations.messages.added"),
                );
            } catch (error: unknown) {
                const responseMessage =
                    axios.isAxiosError(error) &&
                    typeof error.response?.data?.message === "string"
                        ? error.response.data.message
                        : t(
                              "pages.deals.workspace.recommendations.messages.add_failed",
                          );
                message.error(responseMessage);
            } finally {
                setAddingPropertyIds((previous) => {
                    const next = new Set(previous);
                    propertyIds.forEach((id) => next.delete(id));
                    return next;
                });
            }
        },
        [deal.id, setDeal, t],
    );

    return {
        existingPropertyIds,
        addPropertiesToDeal,
        isPropertyAdding,
        isPropertyInDeal,
    };
}

import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export default function useDealRecommendationAdd(deal: Deal) {
    const [addingPropertyIds, setAddingPropertyIds] = useState<Set<number>>(
        new Set(),
    );
    const { setDeal } = useDealWorkspace();

    const existingProductIds = useMemo(
        () => deal.products?.map((product) => product.id) || [],
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
            return existingProductIds.includes(propertyId);
        },
        [existingProductIds],
    );

    const addPropertiesToDeal = useCallback(
        async (propertyIds: number[]) => {
            if (propertyIds.length === 0) return;

            setAddingPropertyIds(
                (previous) => new Set([...previous, ...propertyIds]),
            );

            try {
                const newProductIds = [
                    ...new Set([...existingProductIds, ...propertyIds]),
                ];

                const response = await axios.patch(
                    route("deals.gathering.inline_update", { id: deal.id }),
                    {
                        type: "details",
                        data: { product_id: newProductIds },
                    },
                );

                if (response.data?.status === "success" && response.data?.data) {
                    setDeal(response.data.data);
                }

                message.success(
                    `${propertyIds.length} ${
                        propertyIds.length === 1 ? "property" : "properties"
                    } added to deal`,
                );
            } catch (error: unknown) {
                const responseMessage =
                    typeof error === "object" &&
                    error !== null &&
                    "response" in error &&
                    typeof (error as { response?: { data?: { message?: string } } })
                        .response?.data?.message === "string"
                        ? (error as { response: { data: { message: string } } })
                              .response.data.message
                        : "Failed to add properties";
                message.error(responseMessage);
            } finally {
                setAddingPropertyIds((previous) => {
                    const next = new Set(previous);
                    propertyIds.forEach((id) => next.delete(id));
                    return next;
                });
            }
        },
        [deal.id, existingProductIds, setDeal],
    );

    return {
        existingProductIds,
        addPropertiesToDeal,
        isPropertyAdding,
        isPropertyInDeal,
    };
}

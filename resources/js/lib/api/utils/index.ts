import { QueryClient } from "@tanstack/react-query";
import { getQueryInvalidation } from "./invalidation-mapping";

export const invalidateOnSuccess = (
    client: QueryClient,
    mutationKey: string,
) => {
    const mapping = getQueryInvalidation();
    const keysToInvalidate = mapping?.[mutationKey];
    keysToInvalidate?.forEach((queryKey) => {
        client.invalidateQueries({
            queryKey,
        });
    });

    // Dynamic invalidation for offer mutations where route params vary by offer id.
    // Example mutation keys:
    // /account/offers/123/enable, /account/offers/123/disable,
    // /account/offers/123/attach, /account/offers/123/toggle
    const offersMutationMatch = mutationKey.match(
        /(.*\/offers\/\d+)\/(attach|enable|disable|toggle)$/,
    );

    if (offersMutationMatch) {
        const showPath = offersMutationMatch[1];
        client.invalidateQueries({
            queryKey: [showPath],
        });
    }
};

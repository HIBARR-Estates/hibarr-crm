import { QueryClient } from "@tanstack/react-query";
import { QUERY_INVALIDATION } from "./invalidation-mapping";

export const invalidateOnSuccess = (
    client: QueryClient,
    mutationKey: string
) => {
    const keysToInvalidate = QUERY_INVALIDATION?.[mutationKey];
    keysToInvalidate?.forEach((queryKey) => {
        client.invalidateQueries({
            queryKey,
        });
    });
};

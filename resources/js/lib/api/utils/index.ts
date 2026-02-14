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
};

import { useApiQuery } from "@/lib/api/client";
import { useApiMutate } from "@/lib/api/client";
import type { ApiSuccessResponse } from "@/lib/api/types";
import type {
    AttachedProperty,
    AttachPropertyPayload,
    PropertySearchResult,
    ProjectUnitTypesResponse,
} from "@/Types/api/deal-properties";

export function useDealProperties(dealId: number | undefined) {
    return useApiQuery<ApiSuccessResponse<AttachedProperty[]>>({
        path: route("deals.properties.index", dealId),
        options: { enabled: !!dealId },
    });
}

export function useAttachProperty(dealId: number, onSuccess?: () => void) {
    return useApiMutate<
        AttachPropertyPayload,
        AttachedProperty[],
        ApiSuccessResponse<AttachedProperty[]>
    >(route("deals.properties.store", dealId), "POST", onSuccess);
}

export function useDetachProperty(dealId: number, onSuccess?: () => void) {
    return useApiMutate<{ productId: number }, null, ApiSuccessResponse<null>>(
        // We'll build the URL dynamically in the mutate call
        route("deals.properties.store", dealId),
        "DELETE",
        onSuccess,
    );
}

export function usePropertySearch(query: string) {
    return useApiQuery<ApiSuccessResponse<PropertySearchResult[]>>({
        path: route("deals.properties.search"),
        params: { q: query },
        options: { enabled: query.length >= 1 },
    });
}

export function useProjectUnitTypes(projectId: number | undefined) {
    return useApiQuery<ProjectUnitTypesResponse>({
        path: route("deals.properties.unit_types", projectId || 0),
        options: { enabled: !!projectId },
    });
}

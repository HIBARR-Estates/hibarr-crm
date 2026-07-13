import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface FormDataResponse<T = any> {
    success: boolean;
    data: T[];
    message?: string;
    pagination?: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
    };
}

export type FormDataType =
    | "salutations"
    | "employees"
    | "categories"
    | "sources"
    | "lead-pipelines"
    | "lead-stages"
    | "products"
    | "countries"
    | "client-categories"
    | "languages"
    | "currencies"
    | "lead-agents"
    | "leads"
    | "lead-statuses"
    | "genders"
    | "age-ranges"
    | "packages";

type FormDataParams = {
    page?: number;
    per_page?: number;
    search?: string;
    paginate?: boolean;
    enabled?: boolean;
};

export const useFormData = <T = any>(
    type: FormDataType,
    params: FormDataParams = {
        page: 1,
        per_page: 50,
        search: "",
        paginate: false,
        enabled: true,
    },
) => {
    // Destructure params in dependency array to ensure stability
    const queryParams = useMemo(() => {
        const cleanParams: Record<string, string | number> = {};

        if (params.page && params.page > 1) cleanParams.page = params.page;
        if (params.per_page && params.per_page !== 50)
            cleanParams.per_page = params.per_page;
        if (params.search && params.search.trim())
            cleanParams.search = params.search.trim();

        // Explicitly handle boolean to prevent "The paginate field must be true or false" error
        // Convert to string because useApiQuery expects Record<string, string | number>
        if (typeof params.paginate === "boolean") {
            cleanParams.paginate = params.paginate ? "true" : "false";
        }

        return cleanParams;
    }, [params.page, params.per_page, params.search, params.paginate]);

    // Use useApiQuery as requested
    const {
        data: response,
        isLoading: loading,
        error: queryError,
        refetch,
    } = useApiQuery<FormDataResponse<T>>({
        path: `/account/api/form-data/${type}`,
        params: queryParams,
        options: { enabled: params.enabled !== false },
    });

    // Memoize data extraction to ensure referential stability
    const data = useMemo(() => {
        if (Array.isArray(response?.data)) return response.data;
        // Handle case where data might be wrapped in a data property (Laravel pagination)
        if (Array.isArray((response?.data as any)?.data))
            return (response?.data as any).data;
        return [];
    }, [response]);

    const pagination = response?.pagination || null;
    const error = queryError ? (queryError as Error)?.message : null;

    const fetchData = () => refetch();

    return {
        data,
        loading,
        error,
        pagination,
        refetch,
        fetchData,
    };
};

export const useFormDataBatch = (types: FormDataType[]) => {
    // Sort types for stable cache keys
    const sortedTypes = useMemo(() => [...types].sort(), [types]);

    // Use custom query for batch requests since useApiQuery doesn't handle POST requests
    const {
        data: response,
        isLoading: loading,
        error: queryError,
        refetch,
    } = useQuery<{
        success: boolean;
        data: Record<string, any[]>;
        message?: string;
    }>({
        queryKey: ["formDataBatch", sortedTypes],
        queryFn: async () => {
            const result = await axios.post<{
                success: boolean;
                data: Record<string, any[]>;
                message?: string;
            }>(
                "/account/api/form-data/batch",
                { types: sortedTypes },
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                },
            );

            if (!result.data.success) {
                throw new Error(
                    result.data.message || "Failed to load batch data",
                );
            }

            return result.data;
        },
        enabled: types.length > 0,
        staleTime: 1000 * 60 * 30, // 30 minutes
        gcTime: 1000 * 60 * 60, // 1 hour
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const data = useMemo(() => response?.data || {}, [response]);
    const error = queryError ? (queryError as Error)?.message : null;

    return {
        data,
        loading,
        error,
        refetch,
    };
};

/**
 * Prefer page props when a controller already passed countries; otherwise
 * fetch once via the form-data API (React Query cache).
 */
export function useCountries(options: { enabled?: boolean } = {}) {
    const { props } = usePage<{ countries?: unknown[] }>();
    const pageCountries = props.countries;
    const hasPageData =
        Array.isArray(pageCountries) && pageCountries.length > 0;

    const { data, loading, error, refetch } = useFormData("countries", {
        paginate: false,
        enabled: options.enabled !== false && !hasPageData,
    });

    return {
        countries: (hasPageData ? pageCountries : data) as any[],
        loading: hasPageData ? false : loading,
        error,
        refetch,
    };
}

/**
 * Prefer page props when currencies were passed; otherwise fetch company currencies.
 */
export function useCurrencies(options: { enabled?: boolean } = {}) {
    const { props } = usePage<{ currencies?: unknown[] }>();
    const pageCurrencies = props.currencies;
    const hasPageData =
        Array.isArray(pageCurrencies) && pageCurrencies.length > 0;

    const { data, loading, error, refetch } = useFormData("currencies", {
        paginate: false,
        enabled: options.enabled !== false && !hasPageData,
    });

    return {
        currencies: (hasPageData ? pageCurrencies : data) as any[],
        loading: hasPageData ? false : loading,
        error,
        refetch,
    };
}

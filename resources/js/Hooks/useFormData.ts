import { useState, useEffect } from "react";
import { router } from "@inertiajs/react";

export interface FormDataResponse {
    success: boolean;
    data: any[];
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
    | "lead-statuses";

export const useFormData = (
    type: FormDataType,
    options?: {
        page?: number;
        per_page?: number;
        search?: string;
        autoFetch?: boolean;
    }
) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<
        FormDataResponse["pagination"] | null
    >(null);

    const {
        page = 1,
        per_page = 50,
        search = "",
        autoFetch = true,
    } = options || {};

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString(),
                ...(search && { search }),
            });

            const response = await fetch(
                `/account/api/form-data/${type}?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch ${type} data: ${response.status}`
                );
            }

            const result: FormDataResponse = await response.json();

            if (result.success) {
                setData(result.data);
                setPagination(result.pagination || null);
            } else {
                setError(result.message || `Failed to load ${type} data`);
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : `Failed to fetch ${type} data`
            );
        } finally {
            setLoading(false);
        }
    };

    const refetch = () => fetchData();

    useEffect(() => {
        if (autoFetch) {
            fetchData();
        }
    }, [type, page, per_page, search, autoFetch]);

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
    const [data, setData] = useState<Record<string, any[]>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBatch = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/account/api/form-data/batch", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ types }),
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch batch data: ${response.status}`
                );
            }

            const result = await response.json();

            if (result.success) {
                setData(result.data);
            } else {
                setError(result.message || "Failed to load batch data");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to fetch batch data"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (types.length > 0) {
            fetchBatch();
        }
    }, [types]);

    return {
        data,
        loading,
        error,
        refetch: fetchBatch,
    };
};

import { useMemo } from "react";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { CallLogFilters, CallLogResponse } from "./types";

/**
 * Loads one page of the call log in the background (never on first paint).
 * `path` is the lead endpoint (lead-contact.calls.index) or the company one
 * (telephony.calls.log); filters become query params, empty ones dropped.
 */
export default function useCallLog(
    path: string,
    filters: CallLogFilters,
    page: number,
    perPage: number,
    enabled = true,
) {
    const params = useMemo(() => {
        const out: Record<string, string | number | boolean> = {
            page,
            per_page: perPage,
        };
        for (const [key, value] of Object.entries(filters)) {
            if (value === "" || value === undefined || value === null || value === false) {
                continue;
            }
            out[key] = value === true ? 1 : (value as string | number);
        }
        return out;
    }, [filters, page, perPage]);

    return useApiQuery<CallLogResponse>({
        path,
        params,
        options: { enabled, staleTime: 15_000 },
    });
}

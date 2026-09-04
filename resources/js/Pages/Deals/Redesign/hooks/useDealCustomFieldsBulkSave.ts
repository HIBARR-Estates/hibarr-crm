import { useCallback, useState } from "react";
import axios, { AxiosResponse } from "axios";
import { ApiResponse } from "@/lib/api/types";
import type { Deal } from "@/Types/api/deals";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface CustomFieldsBulkPayload {
    deal?: Record<string, unknown>;
    lead?: Record<string, unknown>;
}

/**
 * Wraps deals.gathering.custom_fields_bulk (Part B of the custom-fields
 * batching work) behind one call site, shared by useDealInfoFieldUpdate
 * (edit-mode saves, expects the full deal back) and useAnalysisFieldSave
 * (analysis modal, lean fire-and-forget saves) instead of each hook posting
 * to it directly.
 *
 * `lean: true` sends X-Analysis-Lean, which tells the server to skip the
 * full deal refresh in its response — `data` is never present in that mode,
 * so the DealWorkspaceContext patch below is a no-op there, matching the
 * modal's existing fire-and-forget behavior.
 */
export default function useDealCustomFieldsBulkSave(dealId: number) {
    const { setDeal } = useDealWorkspace();
    const [saving, setSaving] = useState(false);

    const save = useCallback(
        async (
            payload: CustomFieldsBulkPayload,
            options?: { lean?: boolean },
        ): Promise<AxiosResponse<ApiResponse<Deal>>> => {
            setSaving(true);
            try {
                const response = await axios.patch<ApiResponse<Deal>>(
                    route("deals.gathering.custom_fields_bulk", { id: dealId }),
                    payload,
                    {
                        headers: {
                            Accept: "application/json",
                            ...(options?.lean ? { "X-Analysis-Lean": "1" } : {}),
                        },
                    },
                );
                if (response.data?.status === "success" && response.data?.data) {
                    setDeal(response.data.data);
                }
                return response;
            } finally {
                setSaving(false);
            }
        },
        [dealId, setDeal],
    );

    return { save, saving };
}

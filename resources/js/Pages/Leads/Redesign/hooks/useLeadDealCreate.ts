import { useCallback, useRef, useState } from "react";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Lead } from "@/Types/api/leads";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";
import useLeadMeetingCreate, {
    type LeadMeetingCreateInput,
} from "./useLeadMeetingCreate";

export interface LeadDealCreateInput {
    name: string;
    categoryId: number | null;
    packageId: number | null;
    productId: number | null;
    pipelineId: number | null;
    stageId: number | null;
    agentId: number | null;
    value: number | null;
    valueSource: "manual" | "calculated";
    addKickoffMeeting?: boolean;
    kickoffMeeting?: LeadMeetingCreateInput;
}

interface DealStorePayload {
    name: string;
    lead_contact: number;
    category_id?: number;
    package_id?: number | number[];
    /** Always an array — controller iterates product_id. */
    product_id?: number[];
    pipeline?: number;
    stage_id?: number;
    agent_id?: number;
    value?: number;
    manual_value?: number;
    value_source?: "manual" | "calculated";
}

/** deals.store uses Reply::successWithData merge (top-level `deal`). */
function extractCreatedDeal(response: unknown): Deal | null {
    if (!response || typeof response !== "object") return null;
    const body = response as Record<string, unknown>;
    if (body.status && body.status !== "success") return null;

    const candidates = [body.data, body.deal];
    for (const candidate of candidates) {
        if (
            candidate &&
            typeof candidate === "object" &&
            "id" in candidate &&
            typeof (candidate as { id: unknown }).id === "number"
        ) {
            return candidate as Deal;
        }
    }
    return null;
}

export default function useLeadDealCreate(lead: Lead) {
    const { setDeals, addLeadFollowUp } = useLeadWorkspace();
    const [errors, setErrors] = useState<string[]>([]);
    const inFlightRef = useRef(false);
    const { createMeeting, isCreating: isSchedulingMeeting } =
        useLeadMeetingCreate(lead);

    const { mutate, status } = useApiMutate<
        DealStorePayload,
        Deal,
        ApiResponse<Deal> & { deal?: Deal }
    >(route("deals.store"), "POST");

    const createDeal = useCallback(
        (
            input: LeadDealCreateInput,
            onSuccess?: (deal: Deal) => void,
        ) => {
            if (inFlightRef.current || isLoading({ status })) {
                return;
            }

            const name = input.name.trim();
            if (!name) {
                setErrors(["Deal name is required"]);
                return;
            }
            if (!input.pipelineId || !input.stageId) {
                setErrors(["Pipeline and stage are required"]);
                return;
            }

            const payload: DealStorePayload = {
                name,
                lead_contact: lead.id,
                pipeline: input.pipelineId,
                stage_id: input.stageId,
            };

            if (input.categoryId) payload.category_id = input.categoryId;
            // Scalar or array both accepted — StoreRequest::prepareForValidation
            // normalizes multi-package mode to an array.
            if (input.packageId) payload.package_id = input.packageId;
            if (input.productId) payload.product_id = [input.productId];
            if (input.agentId) payload.agent_id = input.agentId;

            if (input.valueSource === "calculated" && input.value != null) {
                payload.value = Number(input.value);
                payload.value_source = "calculated";
            } else if (input.value != null) {
                payload.manual_value = Number(input.value);
                payload.value_source = "manual";
            }

            setErrors([]);
            inFlightRef.current = true;
            mutate(payload, {
                onSuccess: (response) => {
                    inFlightRef.current = false;
                    const deal = extractCreatedDeal(response);
                    if (!deal) {
                        // Treat a bare success response without a deal body as
                        // failure so we never close as "done" with nothing to show.
                        if (!isSuccessResponse(response)) {
                            setErrors(["Failed to create deal"]);
                            return;
                        }
                        setErrors(["Failed to create deal"]);
                        return;
                    }

                    setDeals((prev) => [
                        deal,
                        ...prev.filter((d) => d.id !== deal.id),
                    ]);

                    const scheduleKickoff =
                        input.addKickoffMeeting && input.kickoffMeeting;

                    if (scheduleKickoff) {
                        createMeeting(
                            {
                                ...input.kickoffMeeting!,
                                dealId: deal.id,
                            },
                            () => onSuccess?.(deal),
                        );
                        return;
                    }

                    onSuccess?.(deal);
                },
                onError: (errorResponse) => {
                    inFlightRef.current = false;
                    const formatted = errorFormatter(errorResponse);
                    const responseErrors = Object.values(
                        formatted.errors || {},
                    ).flat();
                    setErrors(
                        responseErrors.length > 0
                            ? responseErrors
                            : [formatted.message || "Failed to create deal"],
                    );
                },
            });
        },
        [createMeeting, lead.id, mutate, setDeals, status],
    );

    const patchFollowUp = useCallback(
        (followUp: DealFollowup) => {
            addLeadFollowUp(followUp);
        },
        [addLeadFollowUp],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createDeal,
        patchFollowUp,
        isCreating: isLoading({ status }) || inFlightRef.current,
        isSchedulingMeeting,
        errors,
        clearErrors,
    };
}

import { useCallback, useState } from "react";
import { message } from "antd";
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
    pipeline?: number;
    stage_id?: number;
    agent_id?: number;
    value?: number;
    manual_value?: number;
    value_source?: "manual" | "calculated";
}

export default function useLeadDealCreate(lead: Lead) {
    const { setDeals, addLeadFollowUp } = useLeadWorkspace();
    const [errors, setErrors] = useState<string[]>([]);
    const { createMeeting, isCreating: isSchedulingMeeting } =
        useLeadMeetingCreate(lead);

    const { mutate, status } = useApiMutate<
        DealStorePayload,
        Deal,
        ApiResponse<Deal>
    >(route("deals.store"), "POST");

    const createDeal = useCallback(
        (
            input: LeadDealCreateInput,
            onSuccess?: (deal: Deal) => void,
        ) => {
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
            if (input.packageId) payload.package_id = input.packageId;
            if (input.agentId) payload.agent_id = input.agentId;

            if (input.valueSource === "calculated" && input.value != null) {
                payload.value = Number(input.value);
                payload.value_source = "calculated";
            } else if (input.value != null) {
                payload.manual_value = Number(input.value);
                payload.value_source = "manual";
            }

            setErrors([]);
            mutate(payload, {
                onSuccess: (response) => {
                    if (!isSuccessResponse(response) || !response.data) {
                        setErrors(["Failed to create deal"]);
                        return;
                    }

                    const deal = response.data;
                    setDeals((prev) => [
                        deal,
                        ...prev.filter((d) => d.id !== deal.id),
                    ]);
                    message.success("Deal created");

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
        [createMeeting, lead.id, mutate, setDeals],
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
        isCreating: isLoading({ status }),
        isSchedulingMeeting,
        errors,
        clearErrors,
    };
}

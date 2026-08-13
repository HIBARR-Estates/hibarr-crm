/**
 * Lead Qualification Service
 *
 * CRM API client for qualification session persistence.
 */

import axios, { AxiosRequestConfig } from "axios";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { AuthType } from "@/Types";
import type { PageProps } from "@/Components/DashboardLayout";
import {
    CompleteQualificationPayload,
    ExecuteQualificationActionPayload,
    LeadQualificationsResponse,
    LeadQualification,
    QualificationActionRun,
    QualificationLeadPatch,
    StartQualificationPayload,
    UpdateNavigationPayload,
    UpsertAnswerPayload,
} from "@/Types/qualification";
import {
    isLeadQualification,
    normalizeQualificationsIndexResponse,
} from "@/Services/leadQualificationResponse";

interface CrmMutationResponse<T> {
    status?: string;
    message?: string;
    qualification?: T;
    lead?: QualificationLeadPatch | null;
}

const crmRequest = async <T>(
    config: AxiosRequestConfig,
    auth?: AuthType,
): Promise<T> => {
    const response = await axios.request<T>({
        ...config,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(auth?.user?.company_id
                ? { "X-COMPANY-ID": String(auth.user.company_id) }
                : {}),
            ...config.headers,
        },
    });
    return response.data;
};

export class LeadQualificationService {
    constructor(private auth?: AuthType) {}

    async getQualifications(
        leadId: number,
    ): Promise<LeadQualificationsResponse> {
        const response = await crmRequest<Record<string, unknown>>(
            {
                method: "GET",
                url: `/account/lead-contact/${leadId}/qualifications`,
            },
            this.auth,
        );

        return normalizeQualificationsIndexResponse(response);
    }

    async startQualification(
        leadId: number,
        payload: StartQualificationPayload,
    ): Promise<LeadQualification> {
        const response = await crmRequest<CrmMutationResponse<LeadQualification>>(
            {
                method: "POST",
                url: `/account/lead-contact/${leadId}/qualifications`,
                data: payload,
            },
            this.auth,
        );

        if (!isLeadQualification(response.qualification)) {
            throw new Error("Qualification was not returned by the server");
        }

        return response.qualification;
    }

    async upsertAnswer(
        qualificationId: number,
        payload: UpsertAnswerPayload,
    ): Promise<void> {
        await crmRequest(
            {
                method: "PATCH",
                url: `/account/lead-qualifications/${qualificationId}/answers`,
                data: payload,
            },
            this.auth,
        );
    }

    async updateNavigation(
        qualificationId: number,
        payload: UpdateNavigationPayload,
    ): Promise<void> {
        await crmRequest(
            {
                method: "PATCH",
                url: `/account/lead-qualifications/${qualificationId}/navigation`,
                data: payload,
            },
            this.auth,
        );
    }

    async completeQualification(
        qualificationId: number,
        payload: CompleteQualificationPayload,
    ): Promise<{ qualification: LeadQualification; lead: QualificationLeadPatch | null }> {
        const response = await crmRequest<CrmMutationResponse<LeadQualification>>(
            {
                method: "POST",
                url: `/account/lead-qualifications/${qualificationId}/complete`,
                data: payload,
            },
            this.auth,
        );

        if (!isLeadQualification(response.qualification)) {
            throw new Error("Completed qualification was not returned by the server");
        }

        return { qualification: response.qualification, lead: response.lead ?? null };
    }

    async executeAction(
        qualificationId: number,
        actionRunId: number,
        payload: ExecuteQualificationActionPayload = {},
    ): Promise<{
        action_run: QualificationActionRun;
        qualification: LeadQualification;
    }> {
        const response = await crmRequest<{
            action_run?: QualificationActionRun;
            qualification?: LeadQualification;
        }>(
            {
                method: "POST",
                url: `/account/lead-qualifications/${qualificationId}/actions/${actionRunId}/execute`,
                data: payload,
            },
            this.auth,
        );

        if (!response.action_run || !isLeadQualification(response.qualification)) {
            throw new Error("Action execution response was incomplete");
        }

        return {
            action_run: response.action_run,
            qualification: response.qualification,
        };
    }

    async abandonQualification(qualificationId: number): Promise<void> {
        await crmRequest(
            {
                method: "POST",
                url: `/account/lead-qualifications/${qualificationId}/abandon`,
            },
            this.auth,
        );
    }

    async deleteQualification(
        qualificationId: number,
    ): Promise<LeadQualificationsResponse> {
        const response = await crmRequest<{
            workspace?: LeadQualificationsResponse;
        }>(
            {
                method: "DELETE",
                url: `/account/lead-qualifications/${qualificationId}`,
            },
            this.auth,
        );

        return normalizeQualificationsIndexResponse(
            (response.workspace ?? response) as Record<string, unknown>,
        );
    }

    async clearBranchAnswers(
        qualificationId: number,
        segmentKeys: string[],
    ): Promise<void> {
        await crmRequest(
            {
                method: "DELETE",
                url: `/account/lead-qualifications/${qualificationId}/branch-answers`,
                data: { segment_keys: segmentKeys },
            },
            this.auth,
        );
    }
}

export const useLeadQualificationService = (): LeadQualificationService => {
    const { props } = usePage<PageProps>();
    const userId = props.auth?.user?.id;
    const companyId = props.auth?.user?.company_id;

    return useMemo(
        () => new LeadQualificationService(props.auth),
        [userId, companyId],
    );
};

export const createLeadQualificationService = (
    auth?: AuthType,
): LeadQualificationService => new LeadQualificationService(auth);

export default LeadQualificationService;

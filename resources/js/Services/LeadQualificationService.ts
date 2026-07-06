/**
 * Lead Qualification Service
 *
 * CRM API client for qualification session persistence.
 */

import axios, { AxiosRequestConfig } from "axios";
import { usePage } from "@inertiajs/react";
import { AuthType } from "@/Types";
import type { PageProps } from "@/Components/DashboardLayout";
import {
    CompleteQualificationPayload,
    LeadQualificationsResponse,
    LeadQualification,
    StartQualificationPayload,
    UpdateNavigationPayload,
    UpsertAnswerPayload,
} from "@/Types/qualification";

interface CrmMutationResponse<T> {
    status?: string;
    message?: string;
    qualification?: T;
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
        return crmRequest<LeadQualificationsResponse>(
            {
                method: "GET",
                url: `/account/lead-contact/${leadId}/qualifications`,
            },
            this.auth,
        );
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

        if (!response.qualification) {
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
    ): Promise<LeadQualification> {
        const response = await crmRequest<CrmMutationResponse<LeadQualification>>(
            {
                method: "POST",
                url: `/account/lead-qualifications/${qualificationId}/complete`,
                data: payload,
            },
            this.auth,
        );

        if (!response.qualification) {
            throw new Error("Completed qualification was not returned by the server");
        }

        return response.qualification;
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
    return new LeadQualificationService(props.auth);
};

export const createLeadQualificationService = (
    auth?: AuthType,
): LeadQualificationService => new LeadQualificationService(auth);

export default LeadQualificationService;

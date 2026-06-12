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
                url: `/lead-contact/${leadId}/qualifications`,
            },
            this.auth,
        );
    }

    async startQualification(
        leadId: number,
        payload: StartQualificationPayload,
    ): Promise<LeadQualification> {
        return crmRequest<LeadQualification>(
            {
                method: "POST",
                url: `/lead-contact/${leadId}/qualifications`,
                data: payload,
            },
            this.auth,
        );
    }

    async upsertAnswer(
        qualificationId: number,
        payload: UpsertAnswerPayload,
    ): Promise<void> {
        await crmRequest(
            {
                method: "PATCH",
                url: `/lead-qualifications/${qualificationId}/answers`,
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
                url: `/lead-qualifications/${qualificationId}/navigation`,
                data: payload,
            },
            this.auth,
        );
    }

    async completeQualification(
        qualificationId: number,
        payload: CompleteQualificationPayload,
    ): Promise<LeadQualification> {
        return crmRequest<LeadQualification>(
            {
                method: "POST",
                url: `/lead-qualifications/${qualificationId}/complete`,
                data: payload,
            },
            this.auth,
        );
    }

    async abandonQualification(qualificationId: number): Promise<void> {
        await crmRequest(
            {
                method: "POST",
                url: `/lead-qualifications/${qualificationId}/abandon`,
            },
            this.auth,
        );
    }

    async clearBranchAnswers(qualificationId: number): Promise<void> {
        await crmRequest(
            {
                method: "DELETE",
                url: `/lead-qualifications/${qualificationId}/branch-answers`,
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

/**
 * Registration Service
 *
 * OL registration endpoints for consultation booking and webinar sessions.
 */

import axios from "axios";
import { getOlConfig } from "@/lib/config";
import {
    ConsultationCalendlyPayload,
    ConsultationCalendlyResponse,
    GetNextWebinarSessionsResponse,
    IOlConfig,
    MAX_OL_RETRY_COUNT,
    OlApiError,
    RegisterWebinarSessionPayload,
    RegisterWebinarSessionResponse,
} from "@/Types/qualification";

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const getBackoffDelay = (attempt: number, baseDelay: number = 1000): number => {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(exponentialDelay + jitter, 30000);
};

export class RegistrationService {
    private config: Required<IOlConfig>;

    constructor(configOverrides?: Partial<IOlConfig>) {
        this.config = getOlConfig(configOverrides);
    }

    private async withRetry<T>(
        fn: () => Promise<T>,
        operation: string,
    ): Promise<T> {
        const maxRetries = Math.min(this.config.retryCount, MAX_OL_RETRY_COUNT);
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error));

                if (attempt < maxRetries) {
                    const delay = getBackoffDelay(attempt);
                    console.warn(
                        `[RegistrationService] Attempt ${attempt + 1}/${maxRetries + 1} failed for "${operation}". ` +
                            `Retrying in ${Math.round(delay)}ms...`,
                        error,
                    );
                    await sleep(delay);
                }
            }
        }

        throw new OlApiError(
            `${operation} failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
            undefined,
            lastError,
        );
    }

    private get headers() {
        return {
            "X-Api-Key": this.config.apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }

    async bookConsultationCalendly(
        payload: ConsultationCalendlyPayload,
    ): Promise<ConsultationCalendlyResponse> {
        return this.withRetry(async () => {
            const response = await axios.post<ConsultationCalendlyResponse>(
                `${this.config.baseUrl}/registration/consultation/calendly`,
                payload,
                { headers: this.headers },
            );
            return response.data;
        }, "bookConsultationCalendly");
    }

    async getNextWebinarSessions(
        webinarId: string,
    ): Promise<GetNextWebinarSessionsResponse> {
        return this.withRetry(async () => {
            const response = await axios.get<GetNextWebinarSessionsResponse>(
                `${this.config.baseUrl}/internal/${webinarId}/sessions/next`,
                { headers: this.headers },
            );
            return response.data;
        }, "getNextWebinarSessions");
    }

    async registerWebinarSession(
        sessionId: string,
        payload: RegisterWebinarSessionPayload,
    ): Promise<RegisterWebinarSessionResponse> {
        return this.withRetry(async () => {
            const response = await axios.post<RegisterWebinarSessionResponse>(
                `${this.config.baseUrl}/internal/registration/webinar/session/${sessionId}`,
                payload,
                { headers: this.headers },
            );
            return response.data;
        }, "registerWebinarSession");
    }

    updateConfig(configOverrides: Partial<IOlConfig>): void {
        this.config = getOlConfig({ ...this.config, ...configOverrides });
    }
}

let defaultInstance: RegistrationService | null = null;

export const getRegistrationService = (
    configOverrides?: Partial<IOlConfig>,
): RegistrationService => {
    if (!defaultInstance || configOverrides) {
        defaultInstance = new RegistrationService(configOverrides);
    }
    return defaultInstance;
};

export default RegistrationService;

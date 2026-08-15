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
    WebinarSession,
} from "@/Types/qualification";

interface OlWebinarSessionRaw {
    id?: number | string;
    title?: string;
    /** OL's field name; `startsAt` accepted too in case the API converges. */
    startDate?: string;
    startsAt?: string;
    duration?: number;
    timezone?: string;
    status?: string;
}

/**
 * `/sessions/next` returns a *single* session object — not a list — using
 * `startDate` and a numeric id. Normalize to an array of our own shape so
 * callers render 0..n uniformly and a non-array can never reach a list
 * renderer (which crashes the page).
 */
const normalizeWebinarSessions = (payload: unknown): WebinarSession[] => {
    const raw = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object"
          ? [payload]
          : [];

    return raw
        .filter(
            (session): session is OlWebinarSessionRaw =>
                Boolean(session) && typeof session === "object",
        )
        .filter((session) => session.id != null)
        .map((session) => ({
            id: String(session.id),
            title: session.title ?? "Webinar session",
            startsAt: session.startDate ?? session.startsAt ?? "",
            timezone: session.timezone,
            duration: session.duration,
            status: session.status,
        }));
};

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
            const response = await axios.get<{
                success?: boolean;
                data?: unknown;
            }>(
                `${this.config.baseUrl}/internal/${webinarId}/sessions/next`,
                { headers: this.headers },
            );
            return {
                success: response.data?.success ?? true,
                data: normalizeWebinarSessions(response.data?.data),
            };
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

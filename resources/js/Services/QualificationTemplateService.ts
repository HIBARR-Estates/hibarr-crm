/**
 * Qualification Template Service
 *
 * Fetches published qualification templates and segment trees from OL API.
 */

import axios from "axios";
import { getOlConfig } from "@/lib/config";
import {
    GetTemplatesResponse,
    GetTemplateTreeResponse,
    IOlConfig,
    MAX_OL_RETRY_COUNT,
    OlApiError,
} from "@/Types/qualification";

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const getBackoffDelay = (attempt: number, baseDelay: number = 1000): number => {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(exponentialDelay + jitter, 30000);
};

export class QualificationTemplateService {
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
                        `[QualificationTemplateService] Attempt ${attempt + 1}/${maxRetries + 1} failed for "${operation}". ` +
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
            Accept: "application/json",
        };
    }

    async getPublishedTemplates(): Promise<GetTemplatesResponse> {
        return this.withRetry(async () => {
            const response = await axios.get<GetTemplatesResponse>(
                `${this.config.baseUrl}/qualification/templates`,
                { headers: this.headers },
            );
            return response.data;
        }, "getPublishedTemplates");
    }

    async getTemplateTree(templateId: string): Promise<GetTemplateTreeResponse> {
        return this.withRetry(async () => {
            const response = await axios.get<GetTemplateTreeResponse>(
                `${this.config.baseUrl}/qualification/templates/${templateId}/tree`,
                { headers: this.headers },
            );
            return response.data;
        }, "getTemplateTree");
    }

    updateConfig(configOverrides: Partial<IOlConfig>): void {
        this.config = getOlConfig({ ...this.config, ...configOverrides });
    }
}

let defaultInstance: QualificationTemplateService | null = null;

export const getQualificationTemplateService = (
    configOverrides?: Partial<IOlConfig>,
): QualificationTemplateService => {
    if (!defaultInstance || configOverrides) {
        defaultInstance = new QualificationTemplateService(configOverrides);
    }
    return defaultInstance;
};

export default QualificationTemplateService;

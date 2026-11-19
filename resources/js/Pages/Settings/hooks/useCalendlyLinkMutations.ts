import { useCallback, useState } from "react";
import axios from "axios";

export interface CalendlyLinkSetting {
    id: number;
    name: string;
    description: string | null;
    url: string;
    meeting_type_id: number | null;
    role_ids: number[];
    is_active: boolean;
    sort_order: number;
}

export interface CalendlyLinkInput {
    name: string;
    description?: string | null;
    url: string;
    meeting_type_id?: number | null;
    role_ids: number[];
    is_active: boolean;
}

export interface CalendlyWebhookSetting {
    url: string;
    has_signing_key: boolean;
    last_received_at: string | null;
}

/** The first thing the server objected to, else a fallback for the caller to show. */
export function calendlyErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const errors = error.response?.data?.errors as
            | Record<string, string[]>
            | undefined;
        const first = errors ? Object.values(errors).flat()[0] : undefined;
        return first || error.response?.data?.message || fallback;
    }
    return fallback;
}

/**
 * Calendly booking-link settings writes. Each call resolves with what the
 * server saved so the page patches its own list instead of reloading — the
 * Settings page keeps its state, like the Deal workspace does.
 */
export default function useCalendlyLinkMutations() {
    const [saving, setSaving] = useState(false);

    const run = useCallback(async <T>(request: () => Promise<T>): Promise<T> => {
        setSaving(true);
        try {
            return await request();
        } finally {
            setSaving(false);
        }
    }, []);

    const createLink = useCallback(
        (input: CalendlyLinkInput) =>
            run(async () => {
                const { data } = await axios.post<{ data: CalendlyLinkSetting }>(
                    route("calendly-meeting-links.store"),
                    input,
                );
                return data.data;
            }),
        [run],
    );

    const updateLink = useCallback(
        (id: number, input: CalendlyLinkInput) =>
            run(async () => {
                const { data } = await axios.put<{ data: CalendlyLinkSetting }>(
                    route("calendly-meeting-links.update", id),
                    input,
                );
                return data.data;
            }),
        [run],
    );

    const deleteLink = useCallback(
        (id: number) =>
            run(async () => {
                await axios.delete(route("calendly-meeting-links.destroy", id));
            }),
        [run],
    );

    const saveSigningKey = useCallback(
        (signingKey: string) =>
            run(async () => {
                const { data } = await axios.put<{ data: CalendlyWebhookSetting }>(
                    route("calendly-meeting-links.webhook.update"),
                    { signing_key: signingKey },
                );
                return data.data;
            }),
        [run],
    );

    const rotateWebhookAddress = useCallback(
        () =>
            run(async () => {
                const { data } = await axios.post<{ data: CalendlyWebhookSetting }>(
                    route("calendly-meeting-links.webhook.rotate"),
                );
                return data.data;
            }),
        [run],
    );

    return {
        saving,
        createLink,
        updateLink,
        deleteLink,
        saveSigningKey,
        rotateWebhookAddress,
    };
}

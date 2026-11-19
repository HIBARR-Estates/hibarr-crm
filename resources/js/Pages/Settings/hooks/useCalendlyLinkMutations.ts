import { useCallback, useState } from "react";
import axios from "axios";

export interface CalendlyLinkSetting {
    id: number;
    name: string;
    description: string | null;
    url: string;
    role_ids: number[];
    is_active: boolean;
    sort_order: number;
}

export interface CalendlyLinkInput {
    name: string;
    description?: string | null;
    url: string;
    role_ids: number[];
    is_active: boolean;
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
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const createLink = useCallback(async (input: CalendlyLinkInput) => {
        setSaving(true);
        try {
            const { data } = await axios.post<{ data: CalendlyLinkSetting }>(
                route("calendly-meeting-links.store"),
                input,
            );
            return data.data;
        } finally {
            setSaving(false);
        }
    }, []);

    const updateLink = useCallback(
        async (id: number, input: CalendlyLinkInput) => {
            setSaving(true);
            try {
                const { data } = await axios.put<{ data: CalendlyLinkSetting }>(
                    route("calendly-meeting-links.update", id),
                    input,
                );
                return data.data;
            } finally {
                setSaving(false);
            }
        },
        [],
    );

    /** Shows or hides a link from its row, without opening the editor. */
    const setActive = useCallback(
        async (link: CalendlyLinkSetting, isActive: boolean) => {
            setTogglingId(link.id);
            try {
                const { data } = await axios.put<{ data: CalendlyLinkSetting }>(
                    route("calendly-meeting-links.update", link.id),
                    // Only the switch: sending the row's other fields would write
                    // back whatever this page last saw, over another admin's edit.
                    { is_active: isActive },
                );
                return data.data;
            } finally {
                setTogglingId(null);
            }
        },
        [],
    );

    const deleteLink = useCallback(async (id: number) => {
        setDeletingId(id);
        try {
            await axios.delete(route("calendly-meeting-links.destroy", id));
        } finally {
            setDeletingId(null);
        }
    }, []);

    return {
        saving,
        togglingId,
        deletingId,
        createLink,
        updateLink,
        setActive,
        deleteLink,
    };
}

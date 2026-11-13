import { useCallback, useState } from "react";
import axios from "axios";
import type { DisputeView } from "./types";

/** The dispute's short reason is the first line of what the agent wrote, cut to the field's limit. */
const REASON_LIMIT = 100;

export type DisputeOutcome = { ok: true; dispute: DisputeView } | { ok: false; message: string };

function messageOf(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const errors = error.response?.data?.errors as Record<string, string[]> | undefined;
        return errors ? Object.values(errors)[0]?.[0] ?? "" : error.response?.data?.message ?? error.message;
    }
    return error instanceof Error ? error.message : "";
}

/** The first line of the text, trimmed and cut to the reason's length. */
export function reasonOf(text: string): string {
    const line = text.trim().split(/\r?\n/)[0] ?? "";
    return line.length > REASON_LIMIT ? `${line.slice(0, REASON_LIMIT - 1).trimEnd()}…` : line;
}

/**
 * Sends a dispute on a commission through the Affiliate module's own endpoint
 * (the one the classic pages use). The caller patches its own list from the
 * returned dispute, so a dispute is never a page visit.
 */
export default function useCommissionDispute() {
    const [sending, setSending] = useState(false);

    const send = useCallback(async (commissionId: number, text: string): Promise<DisputeOutcome> => {
        setSending(true);
        try {
            const { data } = await axios.post(route("mlm.agent.api.commissions.dispute", commissionId), {
                reason: reasonOf(text),
                message: text.trim(),
            });
            return { ok: true, dispute: data.data as DisputeView };
        } catch (error) {
            return { ok: false, message: messageOf(error) };
        } finally {
            setSending(false);
        }
    }, []);

    return { sending, send };
}

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { EmailConnectionSummary } from "@/Email/types";

export type EmailConnectionProviderOption = {
    id: string;
    label: string;
    fields: string[];
    sandboxes?: string[];
};

export type EmailConnectionDetail = EmailConnectionSummary & {
    sync_stopped_at?: string | null;
    last_sync_at?: string | null;
    last_error_code?: string | null;
};

export type ConnectMailboxInput = {
    provider: string;
    identity_email: string;
    from_email?: string;
    reply_to_email?: string;
    inbox_id?: string;
    sandbox?: string;
    smtp_username?: string;
    smtp_password?: string;
};

export type ReconnectMailboxInput = {
    inbox_id?: string;
    sandbox?: string;
    smtp_username?: string;
    smtp_password?: string;
};

type ConnectionsResponse = {
    connections: EmailConnectionDetail[];
    providers?: EmailConnectionProviderOption[];
};

function errorCodeFrom(error: unknown): string {
    if (!axios.isAxiosError(error)) return "generic";
    const status = error.response?.status;
    if (status === 403) return "forbidden";
    if (status === 404) return "unavailable";
    const data = error.response?.data as
        | { message?: string; errors?: Record<string, string[]> }
        | undefined;
    const firstFieldError = data?.errors
        ? Object.values(data.errors).flat()[0]
        : null;
    if (firstFieldError) return firstFieldError;
    if (typeof data?.message === "string" && data.message) return data.message;
    return "generic";
}

/**
 * Own mailbox connections: list, connect, stop, resume, reconnect, disconnect.
 */
export default function useEmailConnections(options: { open: boolean }) {
    const { open } = options;
    const [connections, setConnections] = useState<EmailConnectionDetail[]>(
        [],
    );
    const [providers, setProviders] = useState<EmailConnectionProviderOption[]>(
        [],
    );
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setErrorCode(null);
        try {
            const response = await axios.get<ConnectionsResponse>(
                "/email/connections",
            );
            setConnections(response.data.connections ?? []);
            setProviders(response.data.providers ?? []);
        } catch (error) {
            setConnections([]);
            setProviders([]);
            setErrorCode(errorCodeFrom(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        void refresh();
    }, [open, refresh]);

    const connect = useCallback(async (input: ConnectMailboxInput) => {
        setBusyId("create");
        setErrorCode(null);
        try {
            const response = await axios.post<{
                connection: EmailConnectionDetail;
            }>("/email/connections", input);
            const created = response.data.connection;
            setConnections((prev) => {
                const without = prev.filter((row) => row.id !== created.id);
                return [...without, created];
            });
            return created;
        } catch (error) {
            setErrorCode(errorCodeFrom(error));
            return null;
        } finally {
            setBusyId(null);
        }
    }, []);

    const stop = useCallback(async (connectionId: string) => {
        setBusyId(connectionId);
        setErrorCode(null);
        try {
            const response = await axios.post<{
                connection: EmailConnectionDetail;
            }>(`/email/connections/${connectionId}/stop`);
            const updated = response.data.connection;
            setConnections((prev) =>
                prev.map((row) => (row.id === updated.id ? updated : row)),
            );
            return updated;
        } catch (error) {
            setErrorCode(errorCodeFrom(error));
            return null;
        } finally {
            setBusyId(null);
        }
    }, []);

    const resume = useCallback(async (connectionId: string) => {
        setBusyId(connectionId);
        setErrorCode(null);
        try {
            const response = await axios.post<{
                connection: EmailConnectionDetail;
            }>(`/email/connections/${connectionId}/resume`);
            const updated = response.data.connection;
            setConnections((prev) =>
                prev.map((row) => (row.id === updated.id ? updated : row)),
            );
            return updated;
        } catch (error) {
            setErrorCode(errorCodeFrom(error));
            return null;
        } finally {
            setBusyId(null);
        }
    }, []);

    const reconnect = useCallback(
        async (connectionId: string, input: ReconnectMailboxInput) => {
            setBusyId(connectionId);
            setErrorCode(null);
            try {
                const response = await axios.put<{
                    connection: EmailConnectionDetail;
                }>(`/email/connections/${connectionId}/reconnect`, input);
                const updated = response.data.connection;
                setConnections((prev) =>
                    prev.map((row) => (row.id === updated.id ? updated : row)),
                );
                return updated;
            } catch (error) {
                setErrorCode(errorCodeFrom(error));
                return null;
            } finally {
                setBusyId(null);
            }
        },
        [],
    );

    const disconnect = useCallback(async (connectionId: string) => {
        setBusyId(connectionId);
        setErrorCode(null);
        try {
            await axios.delete(`/email/connections/${connectionId}`);
            setConnections((prev) =>
                prev.filter((row) => row.id !== connectionId),
            );
            return true;
        } catch (error) {
            setErrorCode(errorCodeFrom(error));
            return false;
        } finally {
            setBusyId(null);
        }
    }, []);

    const clearError = useCallback(() => setErrorCode(null), []);

    return {
        connections,
        providers,
        loading,
        busyId,
        errorCode,
        clearError,
        refresh,
        connect,
        stop,
        resume,
        reconnect,
        disconnect,
    };
}

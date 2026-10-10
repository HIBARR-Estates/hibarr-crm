import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { notifyEmailUnreadChanged } from "@/Email/emailUnreadEvents";
import type {
    EmailConversationDrawerPayload,
    EmailRecordRef,
} from "@/Email/types";

export default function useEmailRecordDrawer(options: {
    open: boolean;
    record: EmailRecordRef | null;
    /** Deep-link / focus message uuid. */
    messageId: string | null;
}) {
    const { open, record, messageId } = options;
    const [payload, setPayload] =
        useState<EmailConversationDrawerPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
        null,
    );

    const load = useCallback(async () => {
        if (!open || !record || !messageId) {
            setPayload(null);
            setSelectedMessageId(null);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await axios.get<EmailConversationDrawerPayload>(
                `/email/records/${record.type}/${record.id}/messages/${messageId}`,
            );
            setPayload(response.data);
            setSelectedMessageId(
                response.data.focus_message_id ??
                    response.data.messages.at(-1)?.id ??
                    null,
            );
            // Opening the exact message marks it read for this user only.
            notifyEmailUnreadChanged();
        } catch {
            setPayload(null);
            setSelectedMessageId(null);
            setError("unavailable");
        } finally {
            setLoading(false);
        }
    }, [open, record, messageId]);

    useEffect(() => {
        void load();
    }, [load]);

    const selectMessage = useCallback(
        (id: string) => {
            setSelectedMessageId(id);
            if (!record) return;
            void axios
                .post<{ unread?: number }>(`/email/messages/${id}/read`)
                .then((response) => {
                    setPayload((current) => {
                        if (!current) return current;
                        return {
                            ...current,
                            messages: current.messages.map((message) =>
                                message.id === id
                                    ? { ...message, unread: false }
                                    : message,
                            ),
                        };
                    });
                    notifyEmailUnreadChanged(
                        typeof response.data.unread === "number"
                            ? response.data.unread
                            : undefined,
                    );
                })
                .catch(() => {
                    /* read state is best-effort */
                });
        },
        [record],
    );

    const selectedMessage =
        payload?.messages.find((message) => message.id === selectedMessageId) ??
        null;

    return {
        payload,
        loading,
        error,
        selectedMessage,
        selectedMessageId,
        selectMessage,
        reload: load,
    };
}

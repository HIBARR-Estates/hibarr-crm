import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type {
    EmailComposerAttachment,
    EmailComposerReplyContext,
    EmailConnectionSummary,
    EmailKnownAddress,
    EmailRecordRef,
    EmailSendAttemptResult,
} from "@/Email/types";

function sameAddress(left: string, right: string): boolean {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function onlyKnown(values: string[], allowed: string[] | null | undefined): string[] {
    if (!allowed) return values;
    return values.filter((value) =>
        allowed.some((address) => sameAddress(address, value)),
    );
}

/** Strip RFC angle brackets — global XSS middleware removes tagged values. */
function bareMessageId(value: string | null | undefined): string | null {
    if (!value) return null;
    const bare = value.trim().replace(/^<|>$/g, "").trim();
    return bare || null;
}

export type ComposerFormState = {
    connectionId: string;
    to: string[];
    cc: string[];
    subject: string;
    body: string;
    includeSignature: boolean;
    attachments: EmailComposerAttachment[];
};

const emptyForm = (connectionId = ""): ComposerFormState => ({
    connectionId,
    to: [],
    cc: [],
    subject: "",
    body: "",
    includeSignature: true,
    attachments: [],
});

export default function useEmailComposer(options: {
    open: boolean;
    enabled: boolean;
    /** Prefill To when composing a new message to a lead/deal contact. */
    prefillTo?: string | null;
    reply?: EmailComposerReplyContext | null;
    /** When set, To/Cc may only be chosen from these addresses. */
    allowedAddresses?: EmailKnownAddress[] | null;
    record?: EmailRecordRef | null;
}) {
    const { open, enabled, prefillTo, reply, allowedAddresses, record } = options;
    const allowed = allowedAddresses?.map((item) => item.address) ?? null;
    const [connections, setConnections] = useState<EmailConnectionSummary[]>(
        [],
    );
    const [loadingConnections, setLoadingConnections] = useState(false);
    const [form, setForm] = useState<ComposerFormState>(emptyForm());
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [lastAttempt, setLastAttempt] =
        useState<EmailSendAttemptResult | null>(null);

    const activeConnections = connections.filter(
        (connection) => connection.status === "active",
    );

    const selectedConnection =
        activeConnections.find((c) => c.id === form.connectionId) ??
        activeConnections[0] ??
        null;

    useEffect(() => {
        if (!open || !enabled) {
            return;
        }

        let cancelled = false;
        setLoadingConnections(true);
        setErrorCode(null);
        setLastAttempt(null);

        axios
            .get<{ connections: EmailConnectionSummary[] }>("/email/connections")
            .then((response) => {
                if (cancelled) return;
                const list = response.data.connections ?? [];
                setConnections(list);
                const firstActive =
                    list.find((c) => c.status === "active") ?? list[0];
                const replySubject = reply?.subject?.trim();
                const subject =
                    replySubject &&
                    !/^re:\s/i.test(replySubject)
                        ? `Re: ${replySubject}`
                        : replySubject || "";

                const requested = reply?.to ?? (prefillTo ? [prefillTo] : []);
                setForm({
                    ...emptyForm(firstActive?.id ?? ""),
                    to: onlyKnown(requested, allowed),
                    subject,
                    includeSignature: true,
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setConnections([]);
                    setErrorCode("connections_unavailable");
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingConnections(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, enabled, prefillTo, reply, allowedAddresses]);

    const updateForm = useCallback(
        (patch: Partial<ComposerFormState>) => {
            setForm((current) => ({ ...current, ...patch }));
            setErrorCode(null);
            setLastAttempt(null);
        },
        [],
    );

    const hasInvalidAttachment = form.attachments.some(
        (file) => !file.downloadable,
    );

    const uploadFiles = useCallback(
        async (files: FileList | File[]) => {
            const connectionId =
                form.connectionId || selectedConnection?.id || "";
            if (!connectionId) {
                setErrorCode("connection_missing");
                return;
            }

            setUploading(true);
            setErrorCode(null);

            try {
                const uploaded: EmailComposerAttachment[] = [];
                for (const file of Array.from(files)) {
                    const body = new FormData();
                    body.append("connection_id", connectionId);
                    body.append("file", file);
                    const response = await axios.post<{
                        file: EmailComposerAttachment;
                    }>("/email/files", body);
                    uploaded.push(response.data.file);
                }
                setForm((current) => ({
                    ...current,
                    attachments: [...current.attachments, ...uploaded],
                }));
            } catch (error) {
                const message =
                    axios.isAxiosError(error) &&
                    typeof error.response?.data?.message === "string"
                        ? error.response.data.message
                        : "upload_failed";
                setErrorCode(message);
            } finally {
                setUploading(false);
            }
        },
        [form.connectionId, selectedConnection?.id],
    );

    const removeAttachment = useCallback((id: string) => {
        setForm((current) => ({
            ...current,
            attachments: current.attachments.filter((file) => file.id !== id),
        }));
        setErrorCode(null);
    }, []);

    const send = useCallback(async (): Promise<EmailSendAttemptResult | null> => {
        const connectionId =
            form.connectionId || selectedConnection?.id || "";
        if (!connectionId) {
            setErrorCode("connection_missing");
            return null;
        }

        if (hasInvalidAttachment) {
            setErrorCode("validation_attachment_unavailable");
            return null;
        }

        setSending(true);
        setErrorCode(null);

        try {
            const response = await axios.post<{
                attempt: EmailSendAttemptResult;
            }>("/email/send", {
                connection_id: connectionId,
                to: form.to,
                cc: form.cc,
                record_type: record?.type,
                record_id: record?.id,
                subject: form.subject,
                text_body: form.body,
                html_body: form.body
                    ? `<p>${form.body
                          .split(/\n+/)
                          .map((line) =>
                              line
                                  .replace(/&/g, "&amp;")
                                  .replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;"),
                          )
                          .join("<br>")}</p>`
                    : null,
                attachment_ids: form.attachments.map((file) => file.id),
                include_signature: form.includeSignature,
                in_reply_to: bareMessageId(reply?.in_reply_to),
                references: (reply?.references ?? [])
                    .map((id) => bareMessageId(id))
                    .filter((id): id is string => Boolean(id)),
            });

            const attempt = response.data.attempt;
            setLastAttempt(attempt);

            if (attempt.status !== "sent") {
                setErrorCode(attempt.error_code ?? attempt.status);
                // Draft retained in form state on failure.
                return attempt;
            }

            return attempt;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const data = error.response?.data as
                    | {
                          message?: string;
                          errors?: Record<string, string[]>;
                          attempt?: EmailSendAttemptResult;
                      }
                    | undefined;
                if (data?.attempt) {
                    setLastAttempt(data.attempt);
                    setErrorCode(
                        data.attempt.error_code ?? data.attempt.status,
                    );
                    return data.attempt;
                }
                const firstError = data?.errors
                    ? Object.values(data.errors).flat()[0]
                    : null;
                setErrorCode(firstError || data?.message || "send_failed");
            } else {
                setErrorCode("send_failed");
            }
            return null;
        } finally {
            setSending(false);
        }
    }, [
        form,
        hasInvalidAttachment,
        reply,
        record,
        selectedConnection?.id,
    ]);

    return {
        connections: activeConnections,
        selectedConnection,
        loadingConnections,
        form,
        updateForm,
        sending,
        uploading,
        errorCode,
        lastAttempt,
        hasInvalidAttachment,
        uploadFiles,
        removeAttachment,
        send,
        reset: () => {
            setForm(emptyForm(selectedConnection?.id ?? ""));
            setErrorCode(null);
            setLastAttempt(null);
        },
    };
}

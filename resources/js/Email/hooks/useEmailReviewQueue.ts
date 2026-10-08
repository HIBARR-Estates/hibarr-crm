import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type {
    EmailAttachCandidate,
    EmailHandoffColleague,
    EmailHandoffRef,
    EmailReviewItem,
    EmailReviewMeta,
} from "@/Email/types";

type DuplicateLeadResponse = {
    message: string;
    record_exists?: boolean;
    candidates?: Array<{ record_type: string; record_id: number }>;
};

export default function useEmailReviewQueue(options: {
    initialItems: EmailReviewItem[];
    initialMeta: EmailReviewMeta;
    initialFocusId?: string | null;
    initialQ?: string | null;
    initialIncoming?: EmailHandoffRef[];
}) {
    const {
        initialItems,
        initialMeta,
        initialFocusId,
        initialQ,
        initialIncoming = [],
    } = options;
    const [items, setItems] = useState(initialItems);
    const [meta, setMeta] = useState(initialMeta);
    const [q, setQ] = useState(initialQ ?? "");
    const [selectedId, setSelectedId] = useState<string | null>(
        initialFocusId ?? initialItems[0]?.id ?? null,
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateCandidates, setDuplicateCandidates] = useState<
        Array<{ record_type: string; record_id: number }>
    >([]);
    const [attachResults, setAttachResults] = useState<EmailAttachCandidate[]>(
        [],
    );
    const [attachSearching, setAttachSearching] = useState(false);
    const [incoming, setIncoming] = useState(initialIncoming);
    const [colleagues, setColleagues] = useState<EmailHandoffColleague[]>([]);
    const [colleagueSearching, setColleagueSearching] = useState(false);

    useEffect(() => {
        setItems(initialItems);
        setMeta(initialMeta);
        setQ(initialQ ?? "");
        setSelectedId(initialFocusId ?? initialItems[0]?.id ?? null);
        setIncoming(initialIncoming);
    }, [initialItems, initialMeta, initialFocusId, initialQ, initialIncoming]);

    const selected =
        items.find((item) => item.id === selectedId) ?? items[0] ?? null;

    const removeItem = useCallback((id: string) => {
        setItems((current) => {
            const next = current.filter((item) => item.id !== id);
            setSelectedId((prev) => {
                if (prev !== id) return prev;
                return next[0]?.id ?? null;
            });
            return next;
        });
        setMeta((current) => ({
            ...current,
            total: Math.max(0, current.total - 1),
        }));
    }, []);

    const patchItem = useCallback((id: string, patch: Partial<EmailReviewItem>) => {
        setItems((current) =>
            current.map((item) =>
                item.id === id ? { ...item, ...patch } : item,
            ),
        );
    }, []);

    const dismiss = useCallback(async (id: string) => {
        setBusy(true);
        setError(null);
        try {
            await axios.post(`/email/copies/${id}/dismiss`);
            removeItem(id);
        } catch {
            setError("dismiss_failed");
        } finally {
            setBusy(false);
        }
    }, [removeItem]);

    const createLead = useCallback(
        async (id: string, clientName?: string) => {
            setBusy(true);
            setError(null);
            setDuplicateCandidates([]);
            try {
                await axios.post(`/email/copies/${id}/create-lead`, {
                    client_name: clientName?.trim() || undefined,
                });
                removeItem(id);
                return { ok: true as const };
            } catch (err) {
                if (axios.isAxiosError(err) && err.response?.status === 409) {
                    const data = err.response.data as DuplicateLeadResponse;
                    if (data.message === "duplicate_lead") {
                        setDuplicateCandidates(data.candidates ?? []);
                        setError("duplicate_lead");
                        return { ok: false as const, duplicate: true as const };
                    }
                    setError(data.message || "create_failed");
                    return { ok: false as const };
                }
                setError("create_failed");
                return { ok: false as const };
            } finally {
                setBusy(false);
            }
        },
        [removeItem],
    );

    const attach = useCallback(
        async (id: string, recordType: string, recordId: number) => {
            setBusy(true);
            setError(null);
            try {
                await axios.post(`/email/copies/${id}/link`, {
                    record_type: recordType,
                    record_id: recordId,
                });
                removeItem(id);
                setDuplicateCandidates([]);
                return true;
            } catch {
                setError("attach_failed");
                return false;
            } finally {
                setBusy(false);
            }
        },
        [removeItem],
    );

    const searchCandidates = useCallback(async (term: string) => {
        const trimmed = term.trim();
        if (trimmed.length < 2) {
            setAttachResults([]);
            return;
        }
        setAttachSearching(true);
        try {
            const { data } = await axios.get<{ items: EmailAttachCandidate[] }>(
                "/email/review/candidates",
                { params: { q: trimmed } },
            );
            setAttachResults(data.items ?? []);
        } catch {
            setAttachResults([]);
            setError("search_failed");
        } finally {
            setAttachSearching(false);
        }
    }, []);

    const searchColleagues = useCallback(async (term: string) => {
        const trimmed = term.trim();
        if (trimmed.length < 1) {
            setColleagues([]);
            return;
        }
        setColleagueSearching(true);
        try {
            const { data } = await axios.get<{ items: EmailHandoffColleague[] }>(
                "/email/handoffs/colleagues",
                { params: { q: trimmed } },
            );
            setColleagues(data.items ?? []);
        } catch {
            setColleagues([]);
            setError("colleague_search_failed");
        } finally {
            setColleagueSearching(false);
        }
    }, []);

    const handoff = useCallback(
        async (
            id: string,
            toUserId: number,
            type: "handoff" | "escalate",
            note?: string,
        ) => {
            setBusy(true);
            setError(null);
            try {
                const path =
                    type === "escalate"
                        ? `/email/copies/${id}/escalate`
                        : `/email/copies/${id}/handoff`;
                const { data } = await axios.post<{
                    copy: EmailReviewItem & {
                        handoff?: EmailHandoffRef | null;
                    };
                }>(path, {
                    to_user_id: toUserId,
                    note: note?.trim() || undefined,
                });
                patchItem(id, {
                    review_status: data.copy.review_status,
                    handoff: data.copy.handoff ?? null,
                });
                return true;
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    const message = (err.response?.data as { message?: string })
                        ?.message;
                    setError(message || "handoff_failed");
                } else {
                    setError("handoff_failed");
                }
                return false;
            } finally {
                setBusy(false);
            }
        },
        [patchItem],
    );

    const resolveIncoming = useCallback(
        async (handoffId: string, action: "accept" | "reject") => {
            setBusy(true);
            setError(null);
            try {
                await axios.post(`/email/handoffs/${handoffId}/${action}`);
                setIncoming((current) =>
                    current.filter((item) => item.id !== handoffId),
                );
                return true;
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    const message = (err.response?.data as { message?: string })
                        ?.message;
                    setError(message || `${action}_failed`);
                } else {
                    setError(`${action}_failed`);
                }
                return false;
            } finally {
                setBusy(false);
            }
        },
        [],
    );

    const refresh = useCallback(async (term?: string) => {
        setBusy(true);
        setError(null);
        try {
            const [review, incomingRes] = await Promise.all([
                axios.get<{
                    items: EmailReviewItem[];
                    meta: EmailReviewMeta;
                }>("/email/review", {
                    params: {
                        q: term?.trim() || undefined,
                        per_page: meta.per_page,
                    },
                }),
                axios.get<{ items: EmailHandoffRef[] }>(
                    "/email/handoffs/incoming",
                ),
            ]);
            setItems(review.data.items);
            setMeta(review.data.meta);
            setSelectedId(review.data.items[0]?.id ?? null);
            setIncoming(incomingRes.data.items ?? []);
        } catch {
            setError("refresh_failed");
        } finally {
            setBusy(false);
        }
    }, [meta.per_page]);

    return {
        items,
        meta,
        q,
        setQ,
        selected,
        selectedId,
        setSelectedId,
        busy,
        error,
        setError,
        duplicateCandidates,
        attachResults,
        attachSearching,
        incoming,
        colleagues,
        colleagueSearching,
        dismiss,
        createLead,
        attach,
        searchCandidates,
        searchColleagues,
        handoff,
        resolveIncoming,
        refresh,
    };
}

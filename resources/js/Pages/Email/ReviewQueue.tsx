import { useEffect, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Button, EmptyState, Modal } from "@/Components/Redesign";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import useEmailReviewQueue from "@/Email/hooks/useEmailReviewQueue";
import type {
    EmailAddressRef,
    EmailHandoffRef,
    EmailReviewItem,
    EmailReviewMeta,
} from "@/Email/types";

import "@/Components/Redesign/redesign.css";

type ReviewQueueProps = {
    items: EmailReviewItem[];
    meta: EmailReviewMeta;
    q: string | null;
    focusId: string | null;
    canCreateLead: boolean;
    canViewWorkReport?: boolean;
    incomingHandoffs?: EmailHandoffRef[];
};

function formatAddress(address: EmailAddressRef | null | undefined): string {
    if (!address?.address) return "";
    return address.name
        ? `${address.name} <${address.address}>`
        : address.address;
}

function formatAddressList(list: EmailAddressRef[] | undefined): string {
    if (!list?.length) return "";
    return list.map((item) => formatAddress(item)).filter(Boolean).join(", ");
}

function formatWhen(value: string | null, locale: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export default function ReviewQueue({
    items: initialItems,
    meta: initialMeta,
    q: initialQ,
    focusId,
    canCreateLead,
    canViewWorkReport = false,
    incomingHandoffs = [],
}: ReviewQueueProps) {
    const { t, locale } = useTranslation();
    const queue = useEmailReviewQueue({
        initialItems,
        initialMeta,
        initialFocusId: focusId,
        initialQ,
        initialIncoming: incomingHandoffs,
    });

    const [createOpen, setCreateOpen] = useState(false);
    const [attachOpen, setAttachOpen] = useState(false);
    const [dismissOpen, setDismissOpen] = useState(false);
    const [handoffOpen, setHandoffOpen] = useState(false);
    const [handoffType, setHandoffType] = useState<"handoff" | "escalate">(
        "handoff",
    );
    const [handoffNote, setHandoffNote] = useState("");
    const [colleagueQuery, setColleagueQuery] = useState("");
    const [clientName, setClientName] = useState("");
    const [attachQuery, setAttachQuery] = useState("");

    const selected = queue.selected;
    const hasPendingHandoff = Boolean(selected?.handoff?.status === "pending");
    const canActOnCopy = !hasPendingHandoff;

    const selectedId = selected?.id;
    const selectedFromName = selected?.from?.name?.trim() || "";

    useEffect(() => {
        if (!createOpen) return;
        setClientName(selectedFromName);
    }, [createOpen, selectedId, selectedFromName]);

    useEffect(() => {
        if (!attachOpen) {
            setAttachQuery("");
            return;
        }
        const handle = window.setTimeout(() => {
            void queue.searchCandidates(attachQuery);
        }, 250);
        return () => window.clearTimeout(handle);
    }, [attachOpen, attachQuery, queue.searchCandidates]);

    useEffect(() => {
        if (!handoffOpen) {
            setColleagueQuery("");
            setHandoffNote("");
            return;
        }
        const handle = window.setTimeout(() => {
            void queue.searchColleagues(colleagueQuery);
        }, 250);
        return () => window.clearTimeout(handle);
    }, [handoffOpen, colleagueQuery, queue.searchColleagues]);

    const errorMessage = queue.error
        ? t(`pages.email.review.errors.${queue.error}`, {
              defaultValue: t("pages.email.review.errors.generic"),
          })
        : null;

    const openHandoff = (type: "handoff" | "escalate") => {
        queue.setError(null);
        setHandoffType(type);
        setHandoffOpen(true);
    };

    const submitHandoffTo = async (userId: number) => {
        if (!selected) return;
        const ok = await queue.handoff(
            selected.id,
            userId,
            handoffType,
            handoffNote,
        );
        if (ok) setHandoffOpen(false);
    };

    const openCreate = () => {
        queue.setError(null);
        setCreateOpen(true);
    };

    const openAttach = () => {
        queue.setError(null);
        setAttachOpen(true);
    };

    const submitCreate = async () => {
        if (!selected) return;
        const result = await queue.createLead(selected.id, clientName);
        if (result.ok) {
            setCreateOpen(false);
            if (focusId) {
                router.visit("/email/review", { replace: true });
            }
        }
    };

    const submitAttach = async (
        recordType: string,
        recordId: number,
    ) => {
        if (!selected) return;
        const ok = await queue.attach(selected.id, recordType, recordId);
        if (ok) {
            setAttachOpen(false);
            setCreateOpen(false);
            if (focusId) {
                router.visit("/email/review", { replace: true });
            }
        }
    };

    const submitDismiss = async () => {
        if (!selected) return;
        await queue.dismiss(selected.id);
        setDismissOpen(false);
        if (focusId) {
            router.visit("/email/review", { replace: true });
        }
    };

    const runSearch = () => {
        void queue.refresh(queue.q);
    };

    return (
        <DashboardLayout>
            <Head title={t("pages.email.review.title")} />
            <PageLayout
                title={t("pages.email.review.title")}
                breadcrumbs={[
                    { name: t("pages.email.review.breadcrumb") },
                ]}
            >
                <div
                    className="flex min-h-[calc(100vh-180px)] flex-col gap-4"
                    style={{ fontFamily: REDESIGN_FONT_STACK }}
                >
                    <header className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h1
                                className="m-0 text-[22px] font-semibold"
                                style={{ color: T.TEXT }}
                            >
                                {t("pages.email.review.title")}
                            </h1>
                            <p
                                className="mb-0 mt-1 text-sm"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {t("pages.email.review.subtitle")}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {canViewWorkReport ? (
                                <Link
                                    href="/email/report"
                                    className="text-sm no-underline"
                                    style={{ color: T.BLUE }}
                                >
                                    {t("pages.email.report.title")}
                                </Link>
                            ) : null}
                            <input
                                type="search"
                                value={queue.q}
                                onChange={(event) =>
                                    queue.setQ(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") runSearch();
                                }}
                                placeholder={t(
                                    "pages.email.review.search_placeholder",
                                )}
                                aria-label={t(
                                    "pages.email.review.search_placeholder",
                                )}
                                className="min-w-[220px] rounded-md border px-3 py-2 text-sm outline-none"
                                style={{
                                    borderColor: T.BORDER,
                                    background: T.SURFACE,
                                    color: T.TEXT,
                                }}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={runSearch}
                                disabled={queue.busy}
                            >
                                {t("pages.email.review.search")}
                            </Button>
                        </div>
                    </header>

                    {errorMessage ? (
                        <div
                            role="alert"
                            className="rounded-md px-3 py-2 text-sm"
                            style={{
                                background: T.SURFACE_2,
                                color: T.TEXT,
                                border: `1px solid ${T.BORDER}`,
                            }}
                        >
                            {errorMessage}
                        </div>
                    ) : null}

                    {queue.incoming.length > 0 ? (
                        <section
                            className="overflow-hidden"
                            style={{
                                background: T.SURFACE,
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: REDESIGN_RADIUS.MD,
                            }}
                        >
                            <div
                                className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                                style={{
                                    borderColor: T.BORDER,
                                    color: T.GRAY_DARKER,
                                }}
                            >
                                {t("pages.email.review.incoming_title")}
                            </div>
                            <ul className="m-0 list-none space-y-0 p-0">
                                {queue.incoming.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3"
                                        style={{ borderColor: T.BORDER }}
                                    >
                                        <div className="min-w-0">
                                            <div
                                                className="truncate text-sm font-semibold"
                                                style={{ color: T.TEXT }}
                                            >
                                                {item.subject?.trim() ||
                                                    t(
                                                        "pages.email.review.no_subject",
                                                    )}
                                            </div>
                                            <div
                                                className="mt-0.5 text-xs"
                                                style={{ color: T.TEXT_MUTED }}
                                            >
                                                {t(
                                                    item.type === "escalate"
                                                        ? "pages.email.review.incoming_escalate_from"
                                                        : "pages.email.review.incoming_handoff_from",
                                                ).replace(
                                                    "{{name}}",
                                                    item.from_user?.name ||
                                                        t(
                                                            "pages.email.review.unknown_sender",
                                                        ),
                                                )}
                                            </div>
                                            <div
                                                className="mt-0.5 text-xs"
                                                style={{ color: T.TEXT_MUTED }}
                                            >
                                                {formatAddress(item.from) ||
                                                    t(
                                                        "pages.email.review.unknown_sender",
                                                    )}
                                                {item.sent_at
                                                    ? ` · ${formatWhen(item.sent_at, locale)}`
                                                    : ""}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                disabled={queue.busy}
                                                onClick={() =>
                                                    void queue.resolveIncoming(
                                                        item.id,
                                                        "accept",
                                                    )
                                                }
                                            >
                                                {t(
                                                    "pages.email.review.accept",
                                                )}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                disabled={queue.busy}
                                                onClick={() =>
                                                    void queue.resolveIncoming(
                                                        item.id,
                                                        "reject",
                                                    )
                                                }
                                            >
                                                {t(
                                                    "pages.email.review.reject",
                                                )}
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}

                    {queue.items.length === 0 && queue.incoming.length === 0 ? (
                        <EmptyState
                            icon="mail"
                            title={t("pages.email.review.empty_title")}
                            description={t(
                                "pages.email.review.empty_description",
                            )}
                        />
                    ) : (
                        <div
                            className="grid flex-1 gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]"
                        >
                            <aside
                                className="overflow-hidden"
                                style={{
                                    background: T.SURFACE,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: REDESIGN_RADIUS.MD,
                                }}
                            >
                                <div
                                    className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                                    style={{
                                        borderColor: T.BORDER,
                                        color: T.GRAY_DARKER,
                                    }}
                                >
                                    {t("pages.email.review.queue_count").replace(
                                        "{{count}}",
                                        String(queue.meta.total),
                                    )}
                                </div>
                                <ul className="m-0 list-none p-0" role="listbox">
                                    {queue.items.map((item) => {
                                        const active =
                                            item.id === queue.selectedId;
                                        return (
                                            <li key={item.id}>
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={active}
                                                    onClick={() =>
                                                        queue.setSelectedId(
                                                            item.id,
                                                        )
                                                    }
                                                    className="w-full border-b px-3 py-3 text-left transition-colors"
                                                    style={{
                                                        borderColor: T.BORDER,
                                                        background: active
                                                            ? T.BLUE_LIGHT
                                                            : "transparent",
                                                    }}
                                                >
                                                    <div
                                                        className="truncate text-sm font-semibold"
                                                        style={{
                                                            color: T.TEXT,
                                                        }}
                                                    >
                                                        {item.subject?.trim() ||
                                                            t(
                                                                "pages.email.review.no_subject",
                                                            )}
                                                    </div>
                                                    <div
                                                        className="mt-0.5 truncate text-xs"
                                                        style={{
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {formatAddress(
                                                            item.from,
                                                        ) ||
                                                            t(
                                                                "pages.email.review.unknown_sender",
                                                            )}
                                                    </div>
                                                    <div
                                                        className="mt-1 line-clamp-2 text-xs leading-relaxed"
                                                        style={{
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {item.preview ||
                                                            item.snippet ||
                                                            t(
                                                                "pages.email.review.no_preview",
                                                            )}
                                                    </div>
                                                    <div
                                                        className="mt-1 flex flex-wrap items-center gap-2 text-[11px]"
                                                        style={{
                                                            color: T.GRAY_DARKER,
                                                        }}
                                                    >
                                                        <span>
                                                            {formatWhen(
                                                                item.sent_at,
                                                                locale,
                                                            )}
                                                        </span>
                                                        {item.handoff?.status ===
                                                        "pending" ? (
                                                            <span
                                                                className="rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide"
                                                                style={{
                                                                    background:
                                                                        T.BLUE_LIGHT,
                                                                    color: T.BLUE_DARK,
                                                                }}
                                                            >
                                                                {t(
                                                                    "pages.email.review.pending_badge",
                                                                )}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </aside>

                            <section
                                className="flex flex-col overflow-hidden"
                                style={{
                                    background: T.SURFACE,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: REDESIGN_RADIUS.MD,
                                }}
                            >
                                {selected ? (
                                    <>
                                        <div
                                            className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3"
                                            style={{ borderColor: T.BORDER }}
                                        >
                                            <div className="min-w-0">
                                                <h2
                                                    className="m-0 truncate text-lg font-semibold"
                                                    style={{ color: T.TEXT }}
                                                >
                                                    {selected.subject?.trim() ||
                                                        t(
                                                            "pages.email.review.no_subject",
                                                        )}
                                                </h2>
                                                <p
                                                    className="mb-0 mt-1 text-sm"
                                                    style={{
                                                        color: T.TEXT_MUTED,
                                                    }}
                                                >
                                                    {formatWhen(
                                                        selected.sent_at,
                                                        locale,
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {canActOnCopy && canCreateLead ? (
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        onClick={openCreate}
                                                        disabled={queue.busy}
                                                    >
                                                        {t(
                                                            "pages.email.review.create_lead",
                                                        )}
                                                    </Button>
                                                ) : null}
                                                {canActOnCopy ? (
                                                    <Button
                                                        type="button"
                                                        variant="navy"
                                                        onClick={openAttach}
                                                        disabled={queue.busy}
                                                    >
                                                        {t(
                                                            "pages.email.review.attach",
                                                        )}
                                                    </Button>
                                                ) : null}
                                                {canActOnCopy ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            openHandoff(
                                                                "handoff",
                                                            )
                                                        }
                                                        disabled={queue.busy}
                                                    >
                                                        {t(
                                                            "pages.email.review.handoff",
                                                        )}
                                                    </Button>
                                                ) : null}
                                                {canActOnCopy ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            openHandoff(
                                                                "escalate",
                                                            )
                                                        }
                                                        disabled={queue.busy}
                                                    >
                                                        {t(
                                                            "pages.email.review.escalate",
                                                        )}
                                                    </Button>
                                                ) : null}
                                                {canActOnCopy ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setDismissOpen(true)
                                                        }
                                                        disabled={queue.busy}
                                                    >
                                                        {t(
                                                            "pages.email.review.dismiss",
                                                        )}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="flex flex-1 flex-col gap-4 p-4">
                                            {hasPendingHandoff ? (
                                                <div
                                                    className="rounded-md px-3 py-2 text-sm"
                                                    style={{
                                                        background:
                                                            T.SURFACE_2,
                                                        border: `1px solid ${T.BORDER}`,
                                                        color: T.TEXT,
                                                    }}
                                                >
                                                    {t(
                                                        "pages.email.review.pending_hint",
                                                    ).replace(
                                                        "{{name}}",
                                                        selected.handoff
                                                            ?.to_user?.name ||
                                                            "—",
                                                    )}
                                                </div>
                                            ) : null}
                                            {selected.record_exists ? (
                                                <div
                                                    className="rounded-md px-3 py-2 text-sm"
                                                    style={{
                                                        background:
                                                            T.SURFACE_2,
                                                        border: `1px solid ${T.BORDER}`,
                                                        color: T.TEXT,
                                                    }}
                                                >
                                                    {t(
                                                        "pages.email.review.record_exists",
                                                    )}
                                                </div>
                                            ) : null}

                                            <dl className="m-0 grid gap-2 text-sm">
                                                <MetaRow
                                                    label={t(
                                                        "pages.email.review.from",
                                                    )}
                                                    value={
                                                        formatAddress(
                                                            selected.from,
                                                        ) || "—"
                                                    }
                                                />
                                                <MetaRow
                                                    label={t(
                                                        "pages.email.review.to",
                                                    )}
                                                    value={
                                                        formatAddressList(
                                                            selected.to,
                                                        ) || "—"
                                                    }
                                                />
                                                {selected.cc.length > 0 ? (
                                                    <MetaRow
                                                        label={t(
                                                            "pages.email.review.cc",
                                                        )}
                                                        value={formatAddressList(
                                                            selected.cc,
                                                        )}
                                                    />
                                                ) : null}
                                            </dl>

                                            <div>
                                                <div
                                                    className="mb-2 text-xs font-semibold uppercase tracking-wide"
                                                    style={{
                                                        color: T.GRAY_DARKER,
                                                        fontSize:
                                                            REDESIGN_TYPE.CAPTION,
                                                    }}
                                                >
                                                    {t(
                                                        "pages.email.review.preview",
                                                    )}
                                                </div>
                                                <div
                                                    className="whitespace-pre-wrap rounded-md px-3 py-3 text-sm leading-relaxed"
                                                    style={{
                                                        background:
                                                            T.SURFACE_2,
                                                        color: T.TEXT,
                                                        border: `1px solid ${T.BORDER}`,
                                                        minHeight: 120,
                                                    }}
                                                >
                                                    {selected.preview?.trim() ||
                                                        t(
                                                            "pages.email.review.no_preview",
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : null}
                            </section>
                        </div>
                    )}
                </div>
            </PageLayout>

            <Modal
                open={createOpen}
                title={t("pages.email.review.create_title")}
                onClose={() => setCreateOpen(false)}
                closeAriaLabel={t("pages.email.review.close")}
                dirty={Boolean(clientName)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setCreateOpen(false)}
                        >
                            {t("pages.email.review.cancel")}
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            loading={queue.busy}
                            onClick={() => void submitCreate()}
                        >
                            {t("pages.email.review.create_confirm")}
                        </Button>
                    </div>
                }
            >
                <p className="m-0 mb-3 text-sm" style={{ color: T.TEXT_MUTED }}>
                    {t("pages.email.review.create_hint")}
                </p>
                <label className="block text-sm">
                    <span
                        className="mb-1 block font-medium"
                        style={{ color: T.TEXT }}
                    >
                        {t("pages.email.review.client_name")}
                    </span>
                    <input
                        value={clientName}
                        onChange={(event) => setClientName(event.target.value)}
                        className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                        style={{
                            borderColor: T.BORDER,
                            background: T.SURFACE,
                            color: T.TEXT,
                        }}
                    />
                </label>
                {queue.error === "duplicate_lead" ? (
                    <div className="mt-3 space-y-2">
                        <p
                            className="m-0 text-sm"
                            style={{ color: T.TEXT }}
                        >
                            {t("pages.email.review.errors.duplicate_lead")}
                        </p>
                        {queue.duplicateCandidates.map((candidate) => (
                            <Button
                                key={`${candidate.record_type}-${candidate.record_id}`}
                                type="button"
                                variant="navy"
                                className="w-full"
                                disabled={queue.busy}
                                onClick={() =>
                                    void submitAttach(
                                        candidate.record_type,
                                        candidate.record_id,
                                    )
                                }
                            >
                                {t(
                                    "pages.email.review.attach_candidate",
                                ).replace(
                                    "{{id}}",
                                    String(candidate.record_id),
                                )}
                            </Button>
                        ))}
                    </div>
                ) : null}
            </Modal>

            <Modal
                open={attachOpen}
                title={t("pages.email.review.attach_title")}
                onClose={() => setAttachOpen(false)}
                closeAriaLabel={t("pages.email.review.close")}
                footer={
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setAttachOpen(false)}
                        >
                            {t("pages.email.review.cancel")}
                        </Button>
                    </div>
                }
            >
                <label className="block text-sm">
                    <span
                        className="mb-1 block font-medium"
                        style={{ color: T.TEXT }}
                    >
                        {t("pages.email.review.attach_search")}
                    </span>
                    <input
                        value={attachQuery}
                        onChange={(event) =>
                            setAttachQuery(event.target.value)
                        }
                        placeholder={t(
                            "pages.email.review.attach_search_placeholder",
                        )}
                        className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                        style={{
                            borderColor: T.BORDER,
                            background: T.SURFACE,
                            color: T.TEXT,
                        }}
                    />
                </label>
                <div className="mt-3 space-y-2">
                    {queue.attachSearching ? (
                        <p
                            className="m-0 text-sm"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {t("pages.email.review.attach_searching")}
                        </p>
                    ) : null}
                    {!queue.attachSearching &&
                    attachQuery.trim().length >= 2 &&
                    queue.attachResults.length === 0 ? (
                        <p
                            className="m-0 text-sm"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {t("pages.email.review.attach_empty")}
                        </p>
                    ) : null}
                    {queue.attachResults.map((candidate) => (
                        <button
                            key={`${candidate.record_type}-${candidate.record_id}`}
                            type="button"
                            disabled={queue.busy}
                            onClick={() =>
                                void submitAttach(
                                    candidate.record_type,
                                    candidate.record_id,
                                )
                            }
                            className="flex w-full flex-col rounded-md border px-3 py-2 text-left text-sm"
                            style={{
                                borderColor: T.BORDER,
                                background: T.SURFACE_2,
                                color: T.TEXT,
                            }}
                        >
                            <span className="font-semibold">
                                {candidate.label}
                            </span>
                            {candidate.email ? (
                                <span
                                    className="text-xs"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {candidate.email}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
            </Modal>

            <Modal
                open={handoffOpen}
                title={t(
                    handoffType === "escalate"
                        ? "pages.email.review.escalate_title"
                        : "pages.email.review.handoff_title",
                )}
                onClose={() => setHandoffOpen(false)}
                closeAriaLabel={t("pages.email.review.close")}
                footer={
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setHandoffOpen(false)}
                        >
                            {t("pages.email.review.cancel")}
                        </Button>
                    </div>
                }
            >
                <p className="m-0 mb-3 text-sm" style={{ color: T.TEXT_MUTED }}>
                    {t(
                        handoffType === "escalate"
                            ? "pages.email.review.escalate_hint"
                            : "pages.email.review.handoff_hint",
                    )}
                </p>
                <label className="mb-3 block text-sm">
                    <span
                        className="mb-1 block font-medium"
                        style={{ color: T.TEXT }}
                    >
                        {t("pages.email.review.handoff_note")}
                    </span>
                    <input
                        value={handoffNote}
                        onChange={(event) => setHandoffNote(event.target.value)}
                        className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                        style={{
                            borderColor: T.BORDER,
                            background: T.SURFACE,
                            color: T.TEXT,
                        }}
                    />
                </label>
                <label className="block text-sm">
                    <span
                        className="mb-1 block font-medium"
                        style={{ color: T.TEXT }}
                    >
                        {t("pages.email.review.colleague_search")}
                    </span>
                    <input
                        value={colleagueQuery}
                        onChange={(event) =>
                            setColleagueQuery(event.target.value)
                        }
                        placeholder={t(
                            "pages.email.review.colleague_search_placeholder",
                        )}
                        className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                        style={{
                            borderColor: T.BORDER,
                            background: T.SURFACE,
                            color: T.TEXT,
                        }}
                    />
                </label>
                <div className="mt-3 space-y-2">
                    {queue.colleagueSearching ? (
                        <p
                            className="m-0 text-sm"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {t("pages.email.review.colleague_searching")}
                        </p>
                    ) : null}
                    {!queue.colleagueSearching &&
                    colleagueQuery.trim().length >= 1 &&
                    queue.colleagues.length === 0 ? (
                        <p
                            className="m-0 text-sm"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {t("pages.email.review.colleague_empty")}
                        </p>
                    ) : null}
                    {queue.colleagues.map((colleague) => (
                        <button
                            key={colleague.id}
                            type="button"
                            disabled={queue.busy}
                            onClick={() => void submitHandoffTo(colleague.id)}
                            className="flex w-full flex-col rounded-md border px-3 py-2 text-left text-sm"
                            style={{
                                borderColor: T.BORDER,
                                background: T.SURFACE_2,
                                color: T.TEXT,
                            }}
                        >
                            <span className="font-semibold">
                                {colleague.name}
                            </span>
                            {colleague.email ? (
                                <span
                                    className="text-xs"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {colleague.email}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
            </Modal>

            <Modal
                open={dismissOpen}
                title={t("pages.email.review.dismiss_title")}
                onClose={() => setDismissOpen(false)}
                closeAriaLabel={t("pages.email.review.close")}
                closeOnBackdrop
                footer={
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setDismissOpen(false)}
                        >
                            {t("pages.email.review.cancel")}
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            loading={queue.busy}
                            onClick={() => void submitDismiss()}
                        >
                            {t("pages.email.review.dismiss_confirm")}
                        </Button>
                    </div>
                }
            >
                <p className="m-0 text-sm" style={{ color: T.TEXT_MUTED }}>
                    {t("pages.email.review.dismiss_hint")}
                </p>
            </Modal>
        </DashboardLayout>
    );
}

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[120px_minmax(0,1fr)]">
            <dt
                className="font-medium"
                style={{ color: T.GRAY_DARKER }}
            >
                {label}
            </dt>
            <dd className="m-0 break-words" style={{ color: T.TEXT }}>
                {value}
            </dd>
        </div>
    );
}

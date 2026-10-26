import { FormEvent, useMemo, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Button } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import useEmailReviewQueue from "@/Email/hooks/useEmailReviewQueue";
import type {
    EmailAddressRef,
    EmailHandoffRef,
    EmailReviewItem,
    EmailReviewMeta,
} from "@/Email/types";
import "@/Components/Redesign/redesign.css";

type InboxThread = {
    id: string;
    subject: string | null;
    latest_sent_at: string | null;
    message_count: number;
    messages: EmailReviewItem[];
};

type InboxProps = {
    threads: InboxThread[];
    preset: number | null;
    from: string;
    to: string;
    state: "all" | "needs_review";
    q: string | null;
    focusId: string | null;
    canCreateLead: boolean;
    canViewWorkReport?: boolean;
    incomingHandoffs?: EmailHandoffRef[];
};

const PRESETS = [7, 14, 30, 90] as const;

function formatAddress(address: EmailAddressRef | null | undefined): string {
    if (!address?.address) return "";
    return address.name
        ? `${address.name} <${address.address}>`
        : address.address;
}

export default function Inbox({
    threads,
    preset,
    from,
    to,
    state,
    q,
    focusId,
    canCreateLead,
    canViewWorkReport = false,
    incomingHandoffs = [],
}: InboxProps) {
    const { t } = useTranslation();
    const messages = useMemo(
        () => threads.flatMap((thread) => thread.messages),
        [threads],
    );
    const meta = useMemo<EmailReviewMeta>(
        () => ({
            current_page: 1,
            last_page: 1,
            per_page: Math.max(messages.length, 1),
            total: messages.length,
        }),
        [messages],
    );
    const queue = useEmailReviewQueue({
        initialItems: messages,
        initialMeta: meta,
        initialFocusId: focusId,
        initialQ: q,
        initialIncoming: incomingHandoffs,
    });
    const [customFrom, setCustomFrom] = useState(from);
    const [customTo, setCustomTo] = useState(to);
    const [query, setQuery] = useState(q ?? "");
    const [clientName, setClientName] = useState("");
    const [attachQuery, setAttachQuery] = useState("");
    const [colleagueQuery, setColleagueQuery] = useState("");

    const selected = queue.selected;
    const needsReview = selected?.review_status === "unlinked";

    const visit = (params: Record<string, string | number | null | undefined>) => {
        router.get(
            "/email/inbox",
            {
                preset: params.preset ?? preset ?? undefined,
                state: params.state ?? state,
                q: params.q === undefined ? query || undefined : params.q || undefined,
                from: params.from || undefined,
                to: params.to || undefined,
                focus: params.focus || undefined,
            },
            { preserveState: false },
        );
    };

    const onCustom = (event: FormEvent) => {
        event.preventDefault();
        visit({ preset: null, from: customFrom, to: customTo });
    };

    return (
        <DashboardLayout>
            <Head title={t("pages.email.inbox.title")} />
            <PageLayout
                title={t("pages.email.inbox.title")}
                breadcrumbs={[{ name: t("pages.email.inbox.title") }]}
                config={{ showTitle: true }}
            >
                <div className="mx-auto flex max-w-6xl flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {PRESETS.map((days) => (
                            <Button
                                key={days}
                                type="button"
                                size="sm"
                                variant={preset === days ? "primary" : "ghost"}
                                onClick={() =>
                                    visit({ preset: days, from: null, to: null })
                                }
                            >
                                {t(`pages.email.inbox.preset_${days}`)}
                            </Button>
                        ))}
                        <Button
                            type="button"
                            size="sm"
                            variant={state === "all" ? "primary" : "ghost"}
                            onClick={() => visit({ state: "all" })}
                        >
                            {t("pages.email.inbox.all")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={
                                state === "needs_review" ? "primary" : "ghost"
                            }
                            onClick={() => visit({ state: "needs_review" })}
                        >
                            {t("pages.email.inbox.needs_review")}
                        </Button>
                        {canViewWorkReport ? (
                            <Link href="/email/report" className="text-sm">
                                {t("pages.email.inbox.work_report")}
                            </Link>
                        ) : null}
                    </div>

                    <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={onCustom}
                    >
                        <label className="text-sm text-dr-text">
                            {t("pages.email.inbox.from")}
                            <input
                                className="dr-input ml-2"
                                type="date"
                                value={customFrom}
                                onChange={(event) =>
                                    setCustomFrom(event.target.value)
                                }
                            />
                        </label>
                        <label className="text-sm text-dr-text">
                            {t("pages.email.inbox.to")}
                            <input
                                className="dr-input ml-2"
                                type="date"
                                value={customTo}
                                onChange={(event) =>
                                    setCustomTo(event.target.value)
                                }
                            />
                        </label>
                        <Button type="submit" size="sm" variant="ghost">
                            {t("pages.email.inbox.apply")}
                        </Button>
                        <label className="text-sm text-dr-text">
                            {t("pages.email.inbox.search")}
                            <input
                                className="dr-input ml-2"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </label>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => visit({ q: query })}
                        >
                            {t("pages.email.inbox.search_submit")}
                        </Button>
                    </form>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
                        <ul className="m-0 list-none space-y-1 p-0">
                            {threads.length === 0 ? (
                                <li className="text-sm text-dr-text-muted">
                                    {t("pages.email.inbox.empty")}
                                </li>
                            ) : (
                                threads.map((thread) => {
                                    const active = thread.messages.some(
                                        (message) =>
                                            message.id === selected?.id,
                                    );
                                    return (
                                        <li key={thread.id}>
                                            <button
                                                type="button"
                                                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                                                    active
                                                        ? "border-dr-blue bg-dr-blue-light"
                                                        : "border-dr-border"
                                                }`}
                                                onClick={() =>
                                                    queue.setSelectedId(
                                                        thread.messages[0].id,
                                                    )
                                                }
                                            >
                                                <div className="truncate font-medium">
                                                    {thread.subject ||
                                                        t(
                                                            "pages.email.drawer.no_subject",
                                                        )}
                                                </div>
                                                <div className="text-xs text-dr-text-muted">
                                                    {formatAddress(
                                                        thread.messages[0]
                                                            ?.from,
                                                    )}
                                                    {" · "}
                                                    {thread.message_count}
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })
                            )}
                        </ul>

                        <section className="rounded border border-dr-border p-4">
                            {selected ? (
                                <div className="flex flex-col gap-3">
                                    <h2 className="m-0 text-base font-semibold">
                                        {selected.subject ||
                                            t(
                                                "pages.email.drawer.no_subject",
                                            )}
                                    </h2>
                                    <p className="m-0 text-sm text-dr-text-muted">
                                        {formatAddress(selected.from)}
                                    </p>
                                    <p className="m-0 whitespace-pre-wrap text-sm">
                                        {selected.preview}
                                    </p>
                                    {needsReview ? (
                                        <div className="flex flex-col gap-2 border-t border-dr-border pt-3">
                                            {canCreateLead ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        className="dr-input"
                                                        value={clientName}
                                                        placeholder={t(
                                                            "pages.email.inbox.lead_name",
                                                        )}
                                                        onChange={(event) =>
                                                            setClientName(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="primary"
                                                        onClick={() =>
                                                            void queue
                                                                .createLead(
                                                                    selected.id,
                                                                    clientName,
                                                                )
                                                                .then(() =>
                                                                    router.reload(),
                                                                )
                                                        }
                                                    >
                                                        {t(
                                                            "pages.email.inbox.create_lead",
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : null}
                                            <div className="flex gap-2">
                                                <input
                                                    className="dr-input"
                                                    value={attachQuery}
                                                    placeholder={t(
                                                        "pages.email.inbox.attach_search",
                                                    )}
                                                    onChange={(event) => {
                                                        setAttachQuery(
                                                            event.target.value,
                                                        );
                                                        void queue.searchCandidates(
                                                            event.target.value,
                                                        );
                                                    }}
                                                />
                                            </div>
                                            <ul className="m-0 list-none p-0">
                                                {queue.attachResults.map(
                                                    (candidate) => (
                                                        <li key={candidate.record_id}>
                                                            <button
                                                                type="button"
                                                                className="text-sm"
                                                                onClick={() =>
                                                                    void queue
                                                                        .attach(
                                                                            selected.id,
                                                                            candidate.record_type,
                                                                            candidate.record_id,
                                                                        )
                                                                        .then(
                                                                            () =>
                                                                                router.reload(),
                                                                        )
                                                                }
                                                            >
                                                                {candidate.label}
                                                            </button>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                            <div className="flex gap-2">
                                                <input
                                                    className="dr-input"
                                                    value={colleagueQuery}
                                                    placeholder={t(
                                                        "pages.email.inbox.handoff_search",
                                                    )}
                                                    onChange={(event) => {
                                                        setColleagueQuery(
                                                            event.target.value,
                                                        );
                                                        void queue.searchColleagues(
                                                            event.target.value,
                                                        );
                                                    }}
                                                />
                                            </div>
                                            <ul className="m-0 list-none p-0">
                                                {queue.colleagues.map(
                                                    (colleague) => (
                                                        <li key={colleague.id}>
                                                            <button
                                                                type="button"
                                                                className="text-sm"
                                                                onClick={() =>
                                                                    void queue.handoff(
                                                                        selected.id,
                                                                        colleague.id,
                                                                        "handoff",
                                                                    )
                                                                }
                                                            >
                                                                {colleague.name}
                                                            </button>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    void queue
                                                        .dismiss(selected.id)
                                                        .then(() =>
                                                            router.reload(),
                                                        )
                                                }
                                            >
                                                {t(
                                                    "pages.email.inbox.dismiss",
                                                )}
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="m-0 text-sm text-dr-text-muted">
                                    {t("pages.email.inbox.empty")}
                                </p>
                            )}
                        </section>
                    </div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}

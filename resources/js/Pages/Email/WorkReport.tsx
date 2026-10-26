import { Head, Link } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { EmptyState } from "@/Components/Redesign";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import type {
    EmailWorkReportCounts,
    EmailWorkReportItem,
    EmailWorkReportSections,
} from "@/Email/types";

import "@/Components/Redesign/redesign.css";

type WorkReportProps = {
    counts: EmailWorkReportCounts;
    sections: EmailWorkReportSections;
};

type SectionKey = keyof EmailWorkReportSections;

const SECTION_KEYS: SectionKey[] = [
    "pending_routing",
    "open_follow_ups",
    "unresolved_handoffs",
    "faults",
];

function formatAge(seconds: number, t: (key: string) => string): string {
    if (seconds < 60) {
        return t("pages.email.report.age_seconds").replace(
            "{{count}}",
            String(seconds),
        );
    }
    if (seconds < 3600) {
        return t("pages.email.report.age_minutes").replace(
            "{{count}}",
            String(Math.floor(seconds / 60)),
        );
    }
    if (seconds < 86400) {
        return t("pages.email.report.age_hours").replace(
            "{{count}}",
            String(Math.floor(seconds / 3600)),
        );
    }
    return t("pages.email.report.age_days").replace(
        "{{count}}",
        String(Math.floor(seconds / 86400)),
    );
}

function mailboxLabel(item: EmailWorkReportItem): string {
    if (!item.mailbox) return "";
    const owner = item.mailbox.owner_name?.trim();
    return owner
        ? `${owner} · ${item.mailbox.email}`
        : item.mailbox.email;
}

export default function WorkReport({ counts, sections }: WorkReportProps) {
    const { t } = useTranslation();
    const total =
        counts.pending_routing +
        counts.open_follow_ups +
        counts.unresolved_handoffs +
        counts.faults;

    return (
        <DashboardLayout>
            <Head title={t("pages.email.report.title")} />
            <PageLayout
                title={t("pages.email.report.title")}
                breadcrumbs={[
                    { name: t("pages.email.report.breadcrumb") },
                ]}
            >
                <div
                    className="flex min-h-[calc(100vh-180px)] flex-col gap-4"
                    style={{ fontFamily: REDESIGN_FONT_STACK }}
                    data-tour="email-work-report"
                >
                    <header className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h1
                                className="m-0 text-[22px] font-semibold"
                                style={{ color: T.TEXT }}
                            >
                                {t("pages.email.report.title")}
                            </h1>
                            <p
                                className="mb-0 mt-1 text-sm"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {t("pages.email.report.subtitle")}
                            </p>
                        </div>
                        <Link
                            href="/email/review"
                            className="text-sm no-underline"
                            style={{ color: T.BLUE }}
                        >
                            {t("pages.email.report.open_review")}
                        </Link>
                    </header>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {SECTION_KEYS.map((key) => (
                            <div
                                key={key}
                                className="px-3 py-3"
                                style={{
                                    background: T.SURFACE,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: REDESIGN_RADIUS.MD,
                                }}
                                data-testid={`email-report-count-${key}`}
                                data-count={
                                    key === "faults"
                                        ? counts.faults
                                        : counts[key]
                                }
                            >
                                <div
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: T.GRAY_DARKER }}
                                >
                                    {t(`pages.email.report.sections.${key}`)}
                                </div>
                                <div
                                    className="mt-1 text-2xl font-semibold"
                                    style={{ color: T.TEXT }}
                                >
                                    {key === "faults"
                                        ? counts.faults
                                        : counts[key]}
                                </div>
                            </div>
                        ))}
                    </div>

                    {total === 0 ? (
                        <EmptyState
                            title={t("pages.email.report.empty_title")}
                            description={t(
                                "pages.email.report.empty_description",
                            )}
                        />
                    ) : (
                        SECTION_KEYS.map((key) => {
                            const items = sections[key];
                            if (items.length === 0) return null;

                            return (
                                <section
                                    key={key}
                                    className="overflow-hidden"
                                    style={{
                                        background: T.SURFACE,
                                        border: `1px solid ${T.BORDER}`,
                                        borderRadius: REDESIGN_RADIUS.MD,
                                    }}
                                    data-testid={`email-report-section-${key}`}
                                >
                                    <div
                                        className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                                        style={{
                                            borderColor: T.BORDER,
                                            color: T.GRAY_DARKER,
                                        }}
                                    >
                                        {t(
                                            `pages.email.report.sections.${key}`,
                                        )}{" "}
                                        · {items.length}
                                    </div>
                                    <ul className="m-0 list-none p-0">
                                        {items.map((item) => (
                                            <li
                                                key={item.id}
                                                className="flex flex-wrap items-start justify-between gap-2 border-b px-3 py-3 last:border-b-0"
                                                style={{
                                                    borderColor: T.BORDER,
                                                }}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div
                                                        className="truncate text-sm font-medium"
                                                        style={{
                                                            color: T.TEXT,
                                                        }}
                                                    >
                                                        {item.label ||
                                                            t(
                                                                "pages.email.report.no_label",
                                                            )}
                                                    </div>
                                                    <div
                                                        className="mt-0.5 text-xs"
                                                        style={{
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {mailboxLabel(item)}
                                                        {mailboxLabel(item)
                                                            ? " · "
                                                            : ""}
                                                        {formatAge(
                                                            item.age_seconds,
                                                            t,
                                                        )}
                                                    </div>
                                                </div>
                                                {item.href ? (
                                                    <Link
                                                        href={item.href}
                                                        className="shrink-0 text-sm no-underline"
                                                        style={{
                                                            color: T.BLUE,
                                                        }}
                                                    >
                                                        {t(
                                                            "pages.email.report.open_item",
                                                        )}
                                                    </Link>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            );
                        })
                    )}
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}

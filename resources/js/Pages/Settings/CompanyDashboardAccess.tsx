import { useRef, useState, type ReactNode } from "react";
import axios from "axios";
import { Deferred } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import "@/Components/Redesign/redesign.css";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import PeoplePicker, { type PersonOption } from "@/Components/Redesign/primitives/PeoplePicker";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { REDESIGN_FONT_STACK, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";

interface Viewer {
    user_id: number;
    name: string;
    email: string | null;
    image: string | null;
    active: boolean;
    added_at: string | null;
}

interface PageProps {
    pageTitle: string;
    viewers: Viewer[];
    /** Deferred: active users of the company, for the picker. */
    people?: PersonOption[];
}

/**
 * Settings → Company dashboard access. Only the people listed here can open
 * the Company dashboard; admins manage the list but aren't on it by default.
 * Changes patch the list from the server's response, no page reload.
 */
export default function CompanyDashboardAccess({ pageTitle, viewers: initialViewers, people }: PageProps) {
    const { t } = useTranslation();
    const [viewers, setViewers] = useState<Viewer[]>(initialViewers);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [error, setError] = useState(false);

    // Each response carries the whole list. Changes are sent one at a time,
    // each after the previous one has finished, so the server applies them in
    // click order and every response already includes the earlier changes.
    // Applying each response as it arrives therefore always moves the list
    // forward; an overlapping pair can never leave someone wrongly listed.
    const queue = useRef<Promise<void>>(Promise.resolve());

    const save = (request: () => Promise<{ data: { viewers?: Viewer[] } }>, userId: number) => {
        setError(false);
        queue.current = queue.current.then(async () => {
            setPendingId(userId);
            try {
                const { data } = await request();
                if (data.viewers) setViewers(data.viewers);
            } catch {
                setError(true);
            } finally {
                setPendingId(null);
            }
        });
        return queue.current;
    };

    const add = (person: PersonOption) =>
        save(() => axios.post(route("company-dashboard-access.store"), { user_id: person.id }), person.id);

    const remove = (viewer: Viewer) =>
        save(() => axios.delete(route("company-dashboard-access.destroy", viewer.user_id)), viewer.user_id);

    // i18next picks the plural form for the locale from a numeric count.
    const count = t("pages.company_dashboard_access.count", { count: viewers.length });

    let picker: ReactNode = null;
    if (pickerOpen) {
        picker = (
            <div style={{ borderBottom: `1px solid ${T.BORDER_SOFT}`, padding: "12px 18px" }}>
                <Deferred
                    data="people"
                    fallback={<div className="dr-skeleton" style={{ height: 160, borderRadius: 8 }} aria-busy="true" />}
                >
                    <PeoplePicker
                        people={people ?? []}
                        exclude={viewers.map((v) => v.user_id)}
                        onPick={add}
                        pendingId={pendingId}
                        autoFocus
                        placeholder={t("pages.company_dashboard_access.search_placeholder")}
                        emptyLabel={t("pages.company_dashboard_access.no_matches")}
                    />
                </Deferred>
            </div>
        );
    }

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: t("app.menu.settings"), url: route("settings-overview.index") },
                { name: pageTitle },
            ]}
        >
            <div
                style={{
                    maxWidth: 820,
                    margin: "0 auto",
                    padding: "20px 0 40px",
                    fontFamily: REDESIGN_FONT_STACK,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                }}
            >
                <section
                    aria-labelledby="cda-heading"
                    style={{ background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 10, overflow: "hidden" }}
                >
                    <header
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "16px 18px",
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                            <h2 id="cda-heading" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.TEXT }}>
                                {t("pages.company_dashboard_access.list_title")}{" "}
                                <span style={{ color: T.TEXT_MUTED, fontWeight: 500 }}>· {count}</span>
                            </h2>
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                                {t("pages.company_dashboard_access.intro")}
                            </p>
                        </div>
                        <Button
                            variant={pickerOpen ? "ghost" : "primary"}
                            icon={<Icon name={pickerOpen ? "x" : "plus"} size={13} />}
                            onClick={() => setPickerOpen((open) => !open)}
                            aria-expanded={pickerOpen}
                        >
                            {pickerOpen ? t("pages.company_dashboard_access.done") : t("pages.company_dashboard_access.add_people")}
                        </Button>
                    </header>

                    {picker}

                    {error && (
                        <div role="alert" style={{ padding: "10px 18px", fontSize: 13, color: T.RED, borderBottom: `1px solid ${T.BORDER_SOFT}` }}>
                            {t("pages.company_dashboard_access.failed")}
                        </div>
                    )}

                    {viewers.length === 0 ? (
                        <div style={{ padding: 18 }}>
                            <EmptyState
                                icon="users"
                                title={t("pages.company_dashboard_access.empty_title")}
                                description={t("pages.company_dashboard_access.empty_description")}
                            />
                        </div>
                    ) : (
                        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                            {viewers.map((viewer) => (
                                <li
                                    key={viewer.user_id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "12px 18px",
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                    }}
                                >
                                    <Avatar initials={initialsFromName(viewer.name)} src={viewer.image} size={32} />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: T.TEXT }}>
                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewer.name}</span>
                                            {!viewer.active && <Badge variant="gray">{t("pages.company_dashboard_access.inactive")}</Badge>}
                                        </div>
                                        {viewer.email && (
                                            <div style={{ fontSize: 12.5, color: T.TEXT_MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {viewer.email}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        loading={pendingId === viewer.user_id}
                                        onClick={() => void remove(viewer)}
                                        aria-label={t("pages.company_dashboard_access.remove_aria", { name: viewer.name })}
                                    >
                                        {t("pages.company_dashboard_access.remove")}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </PageLayout>
    );
}

CompanyDashboardAccess.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;

import { useState, type ReactNode } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import "@/Components/Redesign/redesign.css";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_FONT_STACK, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";

interface CacheGroup {
    key: string;
    ttl_seconds: number;
}

interface PageProps {
    pageTitle: string;
    groups: CacheGroup[];
}

const ALL = "__all__";

/**
 * Settings → Cache refresh. Each row is one group of expiring server caches
 * (see ExpiringCacheRegistry); refreshing clears it so the next read rebuilds
 * it. The browser's own copies of those lists are marked stale as well, so the
 * new values show up without a page reload.
 */
export default function CacheRefresh({ pageTitle, groups }: PageProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [pending, setPending] = useState<string | null>(null);
    const [refreshed, setRefreshed] = useState<string[]>([]);
    const [error, setError] = useState(false);

    const refresh = async (groupKey: string | null) => {
        setError(false);
        setPending(groupKey ?? ALL);
        try {
            const { data } = await axios.post<{ cleared: string[] }>(
                route("cache-refresh.clear"),
                groupKey ? { groups: [groupKey] } : {},
            );
            await queryClient.invalidateQueries();
            setRefreshed((prev) => Array.from(new Set([...prev, ...(data.cleared ?? [])])));
        } catch {
            setError(true);
        } finally {
            setPending(null);
        }
    };

    const expiryLabel = (seconds: number) =>
        seconds % 3600 === 0
            ? t("pages.cache_refresh.expires_hours", { count: seconds / 3600 })
            : t("pages.cache_refresh.expires_minutes", { count: Math.round(seconds / 60) });

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
                }}
            >
                <section
                    aria-labelledby="cache-refresh-heading"
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
                            <h2 id="cache-refresh-heading" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.TEXT }}>
                                {t("pages.cache_refresh.heading")}
                            </h2>
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                                {t("pages.cache_refresh.intro")}
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            icon={<Icon name="refresh" size={13} />}
                            loading={pending === ALL}
                            disabled={pending !== null}
                            onClick={() => void refresh(null)}
                        >
                            {t("pages.cache_refresh.refresh_all")}
                        </Button>
                    </header>

                    {error && (
                        <div role="alert" style={{ padding: "10px 18px", fontSize: 13, color: T.RED, borderBottom: `1px solid ${T.BORDER_SOFT}` }}>
                            {t("pages.cache_refresh.failed")}
                        </div>
                    )}

                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {groups.map((group) => (
                            <li
                                key={group.key}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "14px 18px",
                                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: T.TEXT }}>
                                        {t(`pages.cache_refresh.groups.${group.key}.title`)}
                                        {refreshed.includes(group.key) && (
                                            <Badge variant="green">{t("pages.cache_refresh.refreshed")}</Badge>
                                        )}
                                    </div>
                                    <div style={{ marginTop: 2, fontSize: 13, color: T.TEXT_MUTED }}>
                                        {t(`pages.cache_refresh.groups.${group.key}.description`)}
                                    </div>
                                    <div style={{ marginTop: 4, fontSize: 12, color: T.TEXT_MUTED }}>
                                        {expiryLabel(group.ttl_seconds)}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    loading={pending === group.key}
                                    disabled={pending !== null}
                                    onClick={() => void refresh(group.key)}
                                >
                                    {t("pages.cache_refresh.refresh")}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </PageLayout>
    );
}

CacheRefresh.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;

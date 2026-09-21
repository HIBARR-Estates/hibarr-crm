import { useEffect, useRef, useState } from "react";
import { App } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import "@/Components/Redesign/redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import FirstContactSlaTab from "./FirstContactSlaTab";
import LeadSourcesSection from "./LeadSourcesSection";
import LeadStatusesSection from "./LeadStatusesSection";
import useLeadSettingsNavigation, {
    type LeadSettingsTab,
} from "./hooks/useLeadSettingsNavigation";
import type {
    LeadSourcePermissions,
    LeadSourceRow,
    LeadStatusRow,
    SlaSettings,
} from "./types";

export default function LeadSettingsIndex({
    pageTitle,
    settings,
    sources: initialSources,
    sourcePermissions,
    leadStatuses: initialStatuses,
    currentUserId,
}: {
    pageTitle: string;
    settings: SlaSettings;
    sources: LeadSourceRow[];
    sourcePermissions: LeadSourcePermissions;
    leadStatuses: LeadStatusRow[];
    currentUserId: number;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();
    const { tab, setTab } = useLeadSettingsNavigation();

    const [seconds, setSeconds] = useState(settings.first_contact_sla_seconds);
    const [hasChanges, setHasChanges] = useState(false);
    const [sources, setSources] = useState(initialSources);
    const [statuses, setStatuses] = useState(initialStatuses);

    // Read inside onSuccess below, which closes over the value at the time
    // the request was *sent* — this tracks the live value instead, so a save
    // in flight doesn't clobber hasChanges for an edit made while it waited.
    const secondsRef = useRef(seconds);
    secondsRef.current = seconds;

    const updateMutation = useApiMutate<unknown, unknown, unknown>(
        route("settings-leads.update"),
        "PUT",
    );

    useEffect(() => {
        setSeconds(settings.first_contact_sla_seconds);
        setHasChanges(false);
    }, [settings.first_contact_sla_seconds]);

    useEffect(() => {
        setSources(initialSources);
    }, [initialSources]);

    useEffect(() => {
        setStatuses(initialStatuses);
    }, [initialStatuses]);

    const handleSave = () => {
        const submittedSeconds = seconds;

        updateMutation.mutate(
            { first_contact_sla_seconds: submittedSeconds },
            {
                suppressSuccessToast: true,
                onSuccess: (response: { status?: string }) => {
                    if (response?.status === "success") {
                        message.success(td("Settings saved", { source: "en" }));
                        // Only clear the dirty flag if nothing changed the
                        // value while this request was in flight — otherwise
                        // the newer, unsaved value would show as saved.
                        if (secondsRef.current === submittedSeconds) {
                            setHasChanges(false);
                        }
                    }
                },
                onError: (error: { message?: string }) => {
                    message.error(
                        error?.message ||
                            td("Failed to save settings", { source: "en" }),
                    );
                },
            },
        );
    };

    const tabs: Array<{
        key: LeadSettingsTab;
        label: string;
        count?: number;
    }> = [
        {
            key: "sources",
            label: td("Sources", { source: "en" }),
            count: sources.length,
        },
        {
            key: "statuses",
            label: td("Lead statuses", { source: "en" }),
            count: statuses.length,
        },
        {
            key: "sla",
            label: td("First contact", { source: "en" }),
        },
    ];

    return (
        <PageLayout
            breadcrumbs={[
                {
                    name: t("app.menu.settings"),
                    url: route("settings-overview.index"),
                },
                { name: pageTitle },
            ]}
        >
            <div
                className="mx-auto flex w-full max-w-4xl flex-col"
                style={{
                    padding: "8px 0 32px",
                    fontFamily: REDESIGN_FONT_STACK,
                }}
            >
                <div style={{ marginBottom: 20 }}>
                    <div
                        style={{
                            fontSize: REDESIGN_TYPE.CAPTION,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: T.TEXT_HINT,
                            marginBottom: 6,
                        }}
                    >
                        {td("Settings", { source: "en" })}
                    </div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: REDESIGN_TYPE.DISPLAY,
                            fontWeight: 700,
                            color: T.NAVY,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {td("Lead settings", { source: "en" })}
                    </h1>
                    <p
                        style={{
                            margin: "6px 0 0",
                            fontSize: REDESIGN_TYPE.BODY,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.45,
                            maxWidth: 560,
                        }}
                    >
                        {td(
                            "Company defaults for how leads are handled. Each group of settings lives on its own tab — more will join this page over time.",
                            { source: "en" },
                        )}
                    </p>
                </div>

                <div
                    style={{
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 10,
                        overflow: "hidden",
                    }}
                >
                    <div
                        role="tablist"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "0 24px",
                            padding: "0 22px",
                            borderBottom: `1px solid ${T.BORDER}`,
                        }}
                    >
                        {tabs.map((item) => {
                            const active = tab === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setTab(item.key)}
                                    style={{
                                        position: "relative",
                                        background: "none",
                                        border: "none",
                                        padding: "14px 0 12px",
                                        cursor: "pointer",
                                        fontSize: 14,
                                        fontWeight: active ? 600 : 500,
                                        color: active ? T.NAVY : T.TEXT_MUTED,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    {item.label}
                                    {item.count != null && (
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: active
                                                    ? T.BLUE_DARK
                                                    : T.TEXT_MUTED,
                                                background: active
                                                    ? T.BLUE_LIGHT
                                                    : T.GRAY_MID,
                                                borderRadius: 999,
                                                padding: "1px 8px",
                                            }}
                                        >
                                            {item.count}
                                        </span>
                                    )}
                                    {active && (
                                        <span
                                            style={{
                                                position: "absolute",
                                                left: 0,
                                                right: 0,
                                                bottom: -1,
                                                height: 2,
                                                background: T.BLUE,
                                                borderRadius: 2,
                                            }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ padding: "20px 22px 24px" }}>
                        {tab === "sources" && (
                            <LeadSourcesSection
                                sources={sources}
                                setSources={setSources}
                                permissions={sourcePermissions}
                                currentUserId={currentUserId}
                            />
                        )}
                        {tab === "statuses" && (
                            <LeadStatusesSection
                                statuses={statuses}
                                setStatuses={setStatuses}
                            />
                        )}
                        {tab === "sla" && (
                            <FirstContactSlaTab
                                settings={settings}
                                seconds={seconds}
                                hasChanges={hasChanges}
                                saving={updateMutation.isPending}
                                onSecondsChange={(next) => {
                                    setSeconds(next);
                                    setHasChanges(true);
                                }}
                                onSave={handleSave}
                            />
                        )}
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}

LeadSettingsIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

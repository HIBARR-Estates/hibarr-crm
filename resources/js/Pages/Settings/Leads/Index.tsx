import { useEffect, useState } from "react";
import { App } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import "@/Components/Redesign/redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import LeadSourcesSection from "./LeadSourcesSection";
import type {
    LeadSourcePermissions,
    LeadSourceRow,
    SlaSettings,
} from "./types";

export default function LeadSettingsIndex({
    pageTitle,
    settings,
    sources: initialSources,
    sourcePermissions,
    currentUserId,
}: {
    pageTitle: string;
    settings: SlaSettings;
    sources: LeadSourceRow[];
    sourcePermissions: LeadSourcePermissions;
    currentUserId: number;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();

    const [hours, setHours] = useState(settings.first_contact_sla_hours);
    const [hasChanges, setHasChanges] = useState(false);
    const [sources, setSources] = useState(initialSources);

    const updateMutation = useApiMutate<unknown, unknown, unknown>(
        route("settings-leads.update"),
        "PUT",
    );

    useEffect(() => {
        setHours(settings.first_contact_sla_hours);
        setHasChanges(false);
    }, [settings.first_contact_sla_hours]);

    useEffect(() => {
        setSources(initialSources);
    }, [initialSources]);

    const clampHours = (value: number) =>
        Math.max(settings.min_hours, Math.min(settings.max_hours, value));

    const handleSave = () => {
        updateMutation.mutate(
            { first_contact_sla_hours: hours },
            {
                suppressSuccessToast: true,
                onSuccess: (response: { status?: string }) => {
                    if (response?.status === "success") {
                        message.success(td("Settings saved", { source: "en" }));
                        setHasChanges(false);
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
                className="mx-auto flex w-full max-w-3xl flex-col gap-4"
                style={{
                    padding: "8px 0 32px",
                    fontFamily: REDESIGN_FONT_STACK,
                }}
            >
                <div>
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
                            "Company defaults for how leads are handled — sources, first-contact timing, and related rules. More settings will join this page.",
                            { source: "en" },
                        )}
                    </p>
                </div>

                <LeadSourcesSection
                    sources={sources}
                    setSources={setSources}
                    permissions={sourcePermissions}
                    currentUserId={currentUserId}
                />

                <section
                    style={{
                        background: T.SURFACE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: REDESIGN_RADIUS.MD,
                        padding: 20,
                    }}
                >
                    <div
                        style={{
                            fontSize: REDESIGN_TYPE.CAPTION,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: T.GRAY_DARKER,
                        }}
                    >
                        {td("First contact SLA", { source: "en" })}
                    </div>
                    <p
                        style={{
                            margin: "4px 0 14px",
                            fontSize: REDESIGN_TYPE.BODY,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.45,
                        }}
                    >
                        {td(
                            "How long an agent has to make first contact with a new lead. Drives the Contacted within SLA figure and the overdue-contact column on the team dashboard.",
                            { source: "en" },
                        )}
                    </p>

                    <label
                        htmlFor="first-contact-sla-hours"
                        style={{
                            display: "block",
                            fontSize: REDESIGN_TYPE.CAPTION,
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: T.TEXT_MUTED,
                            marginBottom: 8,
                        }}
                    >
                        {td("Hours to first contact", { source: "en" })}
                    </label>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <input
                            id="first-contact-sla-hours"
                            type="number"
                            className="dr-input"
                            min={settings.min_hours}
                            max={settings.max_hours}
                            value={hours}
                            onChange={(e) => {
                                const next = Number(e.target.value);
                                if (!Number.isFinite(next)) return;
                                setHours(clampHours(next));
                                setHasChanges(true);
                            }}
                            style={{ width: 120, fontSize: REDESIGN_TYPE.BODY }}
                        />
                        <span
                            style={{
                                fontSize: REDESIGN_TYPE.BODY,
                                color: T.TEXT_MUTED,
                            }}
                        >
                            {td("hours", { source: "en" })}
                        </span>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 12,
                            marginTop: 18,
                            paddingTop: 16,
                            borderTop: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        {hasChanges && (
                            <span
                                style={{
                                    fontSize: REDESIGN_TYPE.CAPTION,
                                    color: T.AMBER_TEXT,
                                }}
                            >
                                {td("You have unsaved changes", {
                                    source: "en",
                                })}
                            </span>
                        )}
                        <Button
                            variant="primary"
                            icon={<Icon name="check" size={15} />}
                            onClick={handleSave}
                            loading={updateMutation.isPending}
                            disabled={!hasChanges}
                        >
                            {t("app.save")}
                        </Button>
                    </div>
                </section>
            </div>
        </PageLayout>
    );
}

LeadSettingsIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

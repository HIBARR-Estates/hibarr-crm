import { useMemo, useState } from "react";
import axios from "axios";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import Button from "@/Components/Redesign/primitives/Button";
import SearchableSelect, {
    type SearchableSelectGroup,
} from "@/Components/Redesign/primitives/SearchableSelect";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { getBrowserTimezone } from "@/lib/userTimezone";
import InAppAlertPreferences from "./components/InAppAlertPreferences";
import NotificationBypassList, {
    type BypassType,
} from "./components/NotificationBypassList";
import "@/Components/Redesign/redesign.css";

type AlertSettings = {
    notch_position: string;
    notch_duration_ms: number;
    alerts_muted: boolean;
};

type PreferencesProps = {
    pageTitle: string;
    timezone: string | null;
    timezoneLocked: boolean;
    alertSettings: AlertSettings;
    bypassEnabled: boolean;
    bypassTypes: BypassType[];
    bypassedKeys: string[];
};

function buildTimezoneGroups(): SearchableSelectGroup[] {
    let zones: string[] = [];
    try {
        if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
            zones = (
                Intl as unknown as { supportedValuesOf: (key: string) => string[] }
            ).supportedValuesOf("timeZone");
        }
    } catch {
        zones = [];
    }
    if (zones.length === 0) {
        zones = [
            "UTC",
            "Europe/Berlin",
            "Europe/London",
            "America/New_York",
            "America/Los_Angeles",
            "Asia/Dubai",
            "Asia/Tokyo",
            "Australia/Sydney",
        ];
    }

    const grouped = new Map<string, { value: string; label: string }[]>();
    for (const zone of zones) {
        const region = zone.split("/")[0] ?? "Other";
        const list = grouped.get(region) ?? [];
        list.push({ value: zone, label: zone.replace(/_/g, " ") });
        grouped.set(region, list);
    }

    return Array.from(grouped.entries()).map(([label, options]) => ({
        label,
        options,
    }));
}

function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: REDESIGN_RADIUS.MD,
                padding: 20,
                fontFamily: REDESIGN_FONT_STACK,
            }}
        >
            <div
                style={{
                    fontSize: REDESIGN_TYPE.CAPTION,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: T.GRAY_DARKER,
                    marginBottom: description ? 4 : 14,
                }}
            >
                {title}
            </div>
            {description ? (
                <p
                    style={{
                        margin: "0 0 14px",
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.45,
                    }}
                >
                    {description}
                </p>
            ) : null}
            {children}
        </section>
    );
}

export default function Preferences({
    pageTitle,
    timezone,
    timezoneLocked,
    bypassEnabled,
    bypassTypes,
    bypassedKeys,
}: PreferencesProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const timezoneGroups = useMemo(() => buildTimezoneGroups(), []);
    const [selectedTimezone, setSelectedTimezone] = useState(
        timezone && timezone !== "" ? timezone : "UTC",
    );
    const [locked, setLocked] = useState(timezoneLocked);
    const [savingTimezone, setSavingTimezone] = useState(false);

    const saveTimezone = async (nextTimezone: string, nextLocked: boolean) => {
        setSavingTimezone(true);
        try {
            const response = await axios.post(route("user-preferences.timezone"), {
                timezone: nextTimezone,
                locked: nextLocked,
            });
            const data = response.data as {
                timezone?: string;
                timezoneLocked?: boolean;
            };
            setSelectedTimezone(data.timezone ?? nextTimezone);
            setLocked(data.timezoneLocked ?? nextLocked);
        } finally {
            setSavingTimezone(false);
        }
    };

    const breadcrumbs = [
        { name: t("app.menu.settings"), url: route("profile-settings.index") },
        { name: t("app.settings.preferences") },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={breadcrumbs}
                config={{ showTitle: true }}
            >
                <div
                    className="mx-auto flex max-w-3xl flex-col"
                    style={{ gap: 16, fontFamily: REDESIGN_FONT_STACK }}
                >
                    <Section
                        title={td("Timezone", { source: "en" })}
                        description={td(
                            "Times in the CRM use this zone when per-user timezone is on. Choosing a zone here stops the browser from overwriting it.",
                            { source: "en" },
                        )}
                    >
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <SearchableSelect<string>
                                value={selectedTimezone}
                                options={timezoneGroups}
                                popupMatchSelectWidth={true}
                                style={{ width: "100%" }}
                                onChange={(value) => {
                                    if (!value) return;
                                    setSelectedTimezone(value);
                                    void saveTimezone(value, true);
                                }}
                            />
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    loading={savingTimezone}
                                    onClick={() => {
                                        const browser = getBrowserTimezone();
                                        void saveTimezone(browser, false);
                                    }}
                                >
                                    {td("Use browser timezone", { source: "en" })}
                                </Button>
                                <span
                                    style={{
                                        fontSize: REDESIGN_TYPE.CAPTION,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {locked
                                        ? td("Manual override is on", { source: "en" })
                                        : td("Following browser timezone", { source: "en" })}
                                </span>
                            </div>
                        </div>
                    </Section>

                    <Section
                        title={td("In-app alerts", { source: "en" })}
                        description={td(
                            "Position, duration, and mute for toast alerts in this browser session. These settings are already saved to your account.",
                            { source: "en" },
                        )}
                    >
                        <InAppAlertPreferences />
                    </Section>

                    {bypassEnabled ? (
                        <Section
                            title={td("Notification bypass", { source: "en" })}
                            description={td(
                                "Turn a type off to stop email, in-app, and push for that notification. Security and account emails cannot be bypassed.",
                                { source: "en" },
                            )}
                        >
                            <NotificationBypassList
                                types={bypassTypes}
                                initialBypassedKeys={bypassedKeys}
                            />
                        </Section>
                    ) : null}
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}

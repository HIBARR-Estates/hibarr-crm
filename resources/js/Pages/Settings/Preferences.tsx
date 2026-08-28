import { useMemo, useState } from "react";
import axios from "axios";
import { App } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import SearchableSelect, {
    type SearchableSelectGroup,
} from "@/Components/Redesign/primitives/SearchableSelect";
import Switch from "@/Components/Redesign/primitives/Switch";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    isUserDateTimeEnabled,
    setUserDateTimeContext,
} from "@/lib/userDateTime";
import { getBrowserTimezone } from "@/lib/userTimezone";
import InAppAlertPreferences from "./components/InAppAlertPreferences";
import NotificationBypassList, {
    type BypassType,
} from "./components/NotificationBypassList";
import "@/Components/Redesign/redesign.css";

/** Hardcoded so a missing Ziggy name cannot unmount the page. */
const TIMEZONE_SAVE_URL = "/account/settings/preferences/timezone";

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

function errorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | { message?: string; errors?: Record<string, string[]> }
            | undefined;
        if (typeof data?.message === "string" && data.message !== "") {
            return data.message;
        }
        const firstError = data?.errors
            ? Object.values(data.errors)[0]?.[0]
            : undefined;
        if (typeof firstError === "string" && firstError !== "") {
            return firstError;
        }
    }
    if (error instanceof Error && error.message !== "") {
        return error.message;
    }
    return fallback;
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
    const { message } = App.useApp();
    const timezoneGroups = useMemo(() => buildTimezoneGroups(), []);
    const browserTimezone = useMemo(() => getBrowserTimezone(), []);
    const [selectedTimezone, setSelectedTimezone] = useState(
        timezone && timezone !== "" ? timezone : "UTC",
    );
    const [locked, setLocked] = useState(timezoneLocked);
    const [savingPicker, setSavingPicker] = useState(false);
    const [savingBrowser, setSavingBrowser] = useState(false);

    const saveTimezone = async (
        nextTimezone: string,
        nextLocked: boolean,
        source: "picker" | "browser",
    ) => {
        const previousTimezone = selectedTimezone;
        const previousLocked = locked;
        setSelectedTimezone(nextTimezone);
        setLocked(nextLocked);
        const setSaving =
            source === "picker" ? setSavingPicker : setSavingBrowser;
        setSaving(true);
        try {
            const response = await axios.post(TIMEZONE_SAVE_URL, {
                timezone: nextTimezone,
                locked: nextLocked,
            });
            const data = response.data as {
                timezone?: string;
                timezoneLocked?: boolean;
            };
            const savedTimezone = data.timezone ?? nextTimezone;
            const savedLocked = data.timezoneLocked ?? nextLocked;
            setSelectedTimezone(savedTimezone);
            setLocked(savedLocked);
            setUserDateTimeContext({
                enabled: isUserDateTimeEnabled(),
                timezone: savedTimezone,
            });
        } catch (error) {
            setSelectedTimezone(previousTimezone);
            setLocked(previousLocked);
            message.error(errorMessage(error, t("messages.somethingWentWrong")));
        } finally {
            setSaving(false);
        }
    };

    const breadcrumbs = [
        { name: t("app.menu.settings"), url: "/account/settings/profile" },
        { name: t("app.settings.preferences") },
    ];
    const timezoneBusy = savingPicker || savingBrowser;
    const zoneLabel = selectedTimezone.replace(/_/g, " ");
    const browserZoneLabel = browserTimezone.replace(/_/g, " ");

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={breadcrumbs}
                config={{ showTitle: true }}
            >
                <div
                    className={`mx-auto grid grid-cols-1 gap-4 ${bypassEnabled ? "max-w-6xl lg:grid-cols-2" : "max-w-3xl"}`}
                    style={{ fontFamily: REDESIGN_FONT_STACK }}
                >
                    <div className="flex flex-col gap-4">
                        <Section
                            title={td("Timezone", { source: "en" })}
                            description={td(
                                "Times in the CRM use this zone when per-user timezone is on.",
                                { source: "en" },
                            )}
                        >
                            <SearchableSelect<string>
                                value={selectedTimezone}
                                options={timezoneGroups}
                                popupMatchSelectWidth={true}
                                style={{ width: "100%" }}
                                disabled={timezoneBusy}
                                loading={savingPicker}
                                onChange={(value) => {
                                    if (!value) return;
                                    void saveTimezone(value, true, "picker");
                                }}
                            />
                            <p
                                style={{
                                    margin: "8px 0 0",
                                    fontSize: REDESIGN_TYPE.CAPTION,
                                    color: T.TEXT_MUTED,
                                    lineHeight: 1.4,
                                }}
                            >
                                {savingPicker
                                    ? td("Saving timezone…", { source: "en" })
                                    : `${td("CRM times use", { source: "en" })} ${zoneLabel}.`}
                            </p>

                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    marginTop: 16,
                                    paddingTop: 16,
                                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                                }}
                            >
                                <div style={{ minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: REDESIGN_TYPE.BODY,
                                            color: T.TEXT,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {td("Keep in sync with this browser", {
                                            source: "en",
                                        })}
                                    </div>
                                    <p
                                        style={{
                                            margin: "4px 0 0",
                                            fontSize: REDESIGN_TYPE.CAPTION,
                                            color: T.TEXT_MUTED,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {td("This browser reports", {
                                            source: "en",
                                        })}{" "}
                                        {browserZoneLabel}.{" "}
                                        {td(
                                            "When this is on, the CRM may update your zone on the next visit.",
                                            { source: "en" },
                                        )}
                                    </p>
                                </div>
                                <Switch
                                    checked={!locked}
                                    loading={savingBrowser}
                                    disabled={timezoneBusy && !savingBrowser}
                                    onChange={() => {
                                        if (locked) {
                                            void saveTimezone(
                                                browserTimezone,
                                                false,
                                                "browser",
                                            );
                                        } else {
                                            void saveTimezone(
                                                selectedTimezone,
                                                true,
                                                "browser",
                                            );
                                        }
                                    }}
                                    aria-label={td(
                                        "Keep in sync with this browser",
                                        { source: "en" },
                                    )}
                                />
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
                    </div>

                    {bypassEnabled ? (
                        <Section
                            title={td("Notifications", { source: "en" })}
                            description={td(
                                "Turn a type off to stop email, in-app, and push. Security and account emails cannot be turned off.",
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

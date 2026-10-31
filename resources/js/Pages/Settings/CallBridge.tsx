import React, { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { SoftphoneDeviceSummary } from "@/Types/api/softphone";
import SoftphoneDeviceManager from "./SoftphoneDeviceManager";
import SoftphoneCallPoolManager from "./SoftphoneCallPoolManager";
import SoftphoneRecordingsPanel from "./SoftphoneRecordingsPanel";
import SoftphoneCallLogPanel from "./SoftphoneCallLogPanel";

import "@/Components/Redesign/redesign.css";
import "@/Components/CallRecordingPlayer.css";
import "./CallBridgeSettings.css";

type TabKey = "lines" | "pool" | "calls" | "recordings";
export const CALL_BRIDGE_TABS = ["lines", "pool", "calls", "recordings"] as const;
export type CallBridgeTab = (typeof CALL_BRIDGE_TABS)[number];

interface DevicesResponse {
    status: string;
    data: { devices: SoftphoneDeviceSummary[] };
}

/**
 * Call Bridge settings — page header, card with underlined tabs and one panel
 * per settings group. Styling lives in CallBridgeSettings.css (`cb-*` classes,
 * scoped to `.cb-spec-page`) and resolves to the CRM design tokens.
 */
export default function CallBridge({ pageTitle }: { pageTitle?: string }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props } = usePage();

    const isAdmin = (props.auth?.user?.roles ?? []).some(
        (role: { name?: string }) => role?.name === "admin",
    );

    const [tab, setTab] = useState<CallBridgeTab>("lines");

    const devicesQuery = useApiQuery<DevicesResponse>({
        path: route("telephony.softphone.devices.index"),
    });
    const devices = useMemo(
        () => devicesQuery.data?.data?.devices ?? [],
        [devicesQuery.data],
    );

    const tabs = [
        { key: "lines" as const, label: td("Lines", { source: "en" }), count: devices.length },
        ...(isAdmin
            ? [
                  {
                      key: "pool" as const,
                      label: td("Call pool", { source: "en" }),
                      count: null as number | null,
                  },
              ]
            : []),
        ...(isAdmin
            ? [
                  {
                      key: "calls" as const,
                      label: td("Calls", { source: "en" }),
                      count: null as number | null,
                  },
              ]
            : []),
        {
            key: "recordings" as const,
            label: td("Recordings", { source: "en" }),
            count: null as number | null,
        },
    ].filter((t) => t.key !== "pool" || isAdmin);

    const activeTab = tabs.some((t) => t.key === tab) ? tab : "lines";

    return (
        <PageLayout
            breadcrumbs={[
                { name: t("app.menu.settings"), url: route("settings-overview.index") },
                { name: pageTitle ?? "Call Bridge" },
            ]}
        >
            <div className="cb-spec-page">
                <div className="cb-page">
                    <p className="cb-crumb">{td("Settings", { source: "en" })}</p>
                    <h1 className="cb-title">{pageTitle ?? td("Call Bridge", { source: "en" })}</h1>
                    <p className="cb-lede">
                        {td(
                            "Phone lines, call routing, the call log and recordings for the browser softphone. Each group of settings lives on its own tab.",
                            { source: "en" },
                        )}
                    </p>

                    <div className="cb-card">
                        <div className="cb-tabs" role="tablist">
                            {tabs.map((item) => {
                                const active = item.key === activeTab;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setTab(item.key)}
                                        className="cb-tab"
                                    >
                                        {item.label}
                                        {item.count != null && (
                                            <span className="cb-count">{item.count}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="cb-panel" id="lines" hidden={activeTab !== "lines"}>
                            <SoftphoneDeviceManager />
                        </div>
                        <div className="cb-panel" id="pool" hidden={activeTab !== "pool"}>
                            {isAdmin && <SoftphoneCallPoolManager devices={devices} />}
                        </div>
                        <div className="cb-panel" id="calls" hidden={activeTab !== "calls"}>
                            {isAdmin && activeTab === "calls" && <SoftphoneCallLogPanel />}
                        </div>
                        <div
                            className="cb-panel"
                            id="recs"
                            hidden={activeTab !== "recordings"}
                        >
                            <SoftphoneRecordingsPanel devices={devices} />
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}

CallBridge.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
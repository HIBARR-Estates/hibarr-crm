import React, { useMemo } from "react";
import {
    InfoCircleOutlined,
    UserOutlined,
    PhoneOutlined,
    SwapRightOutlined,
} from "@ant-design/icons";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import type { SoftphoneDeviceSummary } from "@/Types/api/softphone";

import LinePool from "./SoftphoneCallPool/components/LinePool";
import FallbackTierPool from "./SoftphoneCallPool/components/FallbackTierPool";

import "@/Components/Redesign/redesign.css";
import "./CallBridgeSettings.css";
import { useTd } from "@/Hooks/useDynamicTranslation";

// Re-export types for backward compatibility
export type { PoolAgent, EligibleUser, PoolResponse, EligibleResponse, TierScope } from "./SoftphoneCallPool/types";

interface SoftphoneCallPoolManagerProps {
    devices: SoftphoneDeviceSummary[];
    initialFallbackSeconds?: number;
}

/**
 * Incoming call routing pool manager orchestrator:
 * - Tier 1: Lead Owner (Automatic Priority Matching when caller matches a CRM lead)
 * - Tier 2: Line Routing (Primary agent pools for each phone line)
 * - Tier 3: Default Fallback Tier (Company-wide fallback pool)
 * - Tier 4: Admin Fallback Tier (Escalation to administrators)
 * - Tier 5: Automated Voicemail / Voice Message Fallback
 */
export default function SoftphoneCallPoolManager({
    devices,
}: SoftphoneCallPoolManagerProps) {
    const { td } = useTd();
    const sortedDevices = useMemo(() => {
        return [...devices].sort((a, b) => {
            if (a.is_default !== b.is_default) {
                return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
            }
            return a.label.localeCompare(b.label);
        });
    }, [devices]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Call Routing Sequence Explanation Banner */}
            <div
                style={{
                    padding: "14px 18px",
                    borderRadius: "8px",
                    background: "var(--dr-surface-2, #f8fafc)",
                    border: "1px solid var(--dr-border, #e2e8f0)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    color: "var(--dr-text)",
                }}
            >
                <InfoCircleOutlined style={{ color: "var(--dr-blue, #1677ff)", fontSize: "16px", marginTop: "3px" }} />
                <div>
                    <strong style={{ fontSize: "14px" }}>{td("Incoming Call Routing Sequence (Tiers 1 – 4):", { source: "en" })}</strong>
                    <div style={{ marginTop: "4px", color: "var(--dr-text-muted)" }}>
                        When an incoming call matches a lead in the CRM and the assigned Lead Owner has the <strong>{td("Make Calls", { source: "en" })}</strong> permission, the call routes to <strong>{td("Tier 1: Lead Owner", { source: "en" })}</strong> first. If the caller is not matched to a lead, or if the lead owner lacks the Make Calls permission, is unavailable, has paused calls, or does not answer within the ring window, calls advance to <strong>{td("Tier 2: Line Routing", { source: "en" })}</strong>, then <strong>{td("Tier 3: Default Fallback Tier", { source: "en" })}</strong>, and finally <strong>{td("Tier 4: Admin Fallback Tier", { source: "en" })}</strong> before automated voicemail. Configure rotation timings and voicemail greeting under the <strong>Call Rotation & Timing</strong> tab.
                    </div>
                </div>
            </div>

            {/* Section 1: Tier 1 - Lead Owner Routing */}
            <div className="cb-group" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--dr-text)" }}>
                                {td("Tier 1: Lead Owner Routing", { source: "en" })}
                            </h3>
                            <span className="cb-chip" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--dr-green, #10b981)", fontWeight: 600 }}>
                                {td("Priority Match · Active", { source: "en" })}
                            </span>
                        </div>
                        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--dr-text-muted)", maxWidth: "820px" }}>
                            Whenever an incoming caller's phone number matches an existing lead or contact in the CRM, the call routes <strong>{td("directly to the assigned Lead Owner first", { source: "en" })}</strong> — provided they hold the <strong>{td("Make Calls", { source: "en" })}</strong> permission and are ready for calls. If the lead has no owner, the owner lacks permission, has paused calls, or does not answer within the ring window, the call automatically advances to <strong>{td("Tier 2: Line Routing", { source: "en" })}</strong> (available agents ring one at a time, in priority order).
                        </p>
                    </div>
                </div>

                {/* Lead Owner Flow Cards */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "14px",
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop: "1px solid var(--dr-border, #e2e8f0)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                        <div
                            style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: "rgba(22, 119, 255, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#1677ff",
                                flexShrink: 0,
                            }}
                        >
                            <PhoneOutlined />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: "var(--dr-text)" }}>{td("Caller Phone Match", { source: "en" })}</div>
                            <div style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>{td("Automatic lookup in CRM leads", { source: "en" })}</div>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                        <div
                            style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: "rgba(16, 185, 129, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#10b981",
                                flexShrink: 0,
                            }}
                        >
                            <UserOutlined />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: "var(--dr-text)" }}>{td("Lead Owner Rings First", { source: "en" })}</div>
                            <div style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>{td("Direct to owner's softphone (requires Make Calls permission)", { source: "en" })}</div>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                        <div
                            style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: "rgba(245, 158, 11, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#d97706",
                                flexShrink: 0,
                            }}
                        >
                            <SwapRightOutlined />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: "var(--dr-text)" }}>{td("Automatic Escalation", { source: "en" })}</div>
                            <div style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>{td("Advances to Tier 2 if no permission, missed, or paused", { source: "en" })}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Tier 2 - Line Routing */}
            <div>
                <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--dr-text)" }}>
                            {td("Tier 2: Line Routing", { source: "en" })}
                        </h3>
                        <span className="cb-chip" style={{ background: "var(--dr-surface-2)", color: "var(--dr-text)" }}>
                            {td("Line Agent Pools", { source: "en" })}
                        </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--dr-text-muted)" }}>
                        {td("Configure the primary agent pool for each phone line. Unmatched calls or calls unanswered by the lead owner ring these line agents in priority order.", { source: "en" })}
                    </p>
                </div>

                {sortedDevices.length === 0 ? (
                    <EmptyState title={td("No phone lines", { source: "en" })} description={td("Add a line under the Lines tab first.", { source: "en" })} />
                ) : (
                    sortedDevices.map((device) => <LinePool key={device.id} device={device} />)
                )}
            </div>

            {/* Section 3: Tier 3 - Default Fallback Tier */}
            <FallbackTierPool
                tierScope="default_fallback"
                title={td("Default Fallback Tier", { source: "en" })}
                tierBadge="Tier 3: Global Fallback"
                description={td("Company-wide default fallback tier for all incoming calls across every line. If the lead owner and line agents are unavailable or pass, calls route here before escalating to admins.", { source: "en" })}
                emptyStateMessage="No default fallback users assigned. Unanswered calls will advance directly to the Admin Fallback Tier."
                addLabel="Add user to default fallback tier"
                placeholder={td("Search active users and managers", { source: "en" })}
            />

            {/* Section 4: Tier 4 - Admin Fallback Tier */}
            <FallbackTierPool
                tierScope="admin_fallback"
                title={td("Admin Fallback Tier", { source: "en" })}
                tierBadge="Tier 4: Admin Escalation"
                description={td("Users on this list receive calls if neither the lead owner, line agents, nor the default fallback tier answer. Only users with the admin role can be added to this list.", { source: "en" })}
                emptyStateMessage="No administrators assigned. Calls will not escalate to admins unless they are added to this list."
                addLabel="Add admin to fallback tier"
                placeholder={td("Search active administrators", { source: "en" })}
            />
        </div>
    );
}

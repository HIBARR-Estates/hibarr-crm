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
                    <strong style={{ fontSize: "14px" }}>Incoming Call Routing Sequence (Tiers 1 – 4):</strong>
                    <div style={{ marginTop: "4px", color: "var(--dr-text-muted)" }}>
                        When an incoming call matches a lead in the CRM, the call routes to <strong>Tier 1: Lead Owner</strong> first. If the caller is not matched to a lead, or if the lead owner is unavailable, has paused calls, or does not answer within the ring window, calls advance to <strong>Tier 2: Line Routing</strong>, then <strong>Tier 3: Default Fallback Tier</strong>, and finally <strong>Tier 4: Admin Fallback Tier</strong> before automated voicemail. Configure rotation timings and voicemail greeting under the <strong>Call Rotation & Timing</strong> tab.
                    </div>
                </div>
            </div>

            {/* Section 1: Tier 1 - Lead Owner Routing */}
            <div className="cb-group" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--dr-text)" }}>
                                Tier 1: Lead Owner Routing
                            </h3>
                            <span className="cb-chip" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--dr-green, #10b981)", fontWeight: 600 }}>
                                Priority Match · Active
                            </span>
                        </div>
                        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--dr-text-muted)", maxWidth: "820px" }}>
                            Whenever an incoming caller's phone number matches an existing lead or contact in the CRM, the call routes <strong>directly to the assigned Lead Owner first</strong>. If the lead has no owner, the owner has paused calls, or does not answer within the ring window, the call automatically advances to <strong>Tier 2: Line Routing</strong>.
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
                            <div style={{ fontWeight: 600, color: "var(--dr-text)" }}>Caller Phone Match</div>
                            <div style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>Automatic lookup in CRM leads</div>
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
                            <div style={{ fontWeight: 600, color: "var(--dr-text)" }}>Lead Owner Rings First</div>
                            <div style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>Direct to owner's softphone</div>
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
                            <div style={{ fontWeight: 600, color: "var(--dr-text)" }}>Automatic Escalation</div>
                            <div style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>Advances to Tier 2 if missed/paused</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Tier 2 - Line Routing */}
            <div>
                <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--dr-text)" }}>
                            Tier 2: Line Routing
                        </h3>
                        <span className="cb-chip" style={{ background: "var(--dr-surface-2)", color: "var(--dr-text)" }}>
                            Line Agent Pools
                        </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--dr-text-muted)" }}>
                        Configure the primary agent pool for each phone line. Unmatched calls or calls unanswered by the lead owner ring these line agents in priority order.
                    </p>
                </div>

                {sortedDevices.length === 0 ? (
                    <EmptyState title="No phone lines" description="Add a line under the Lines tab first." />
                ) : (
                    sortedDevices.map((device) => <LinePool key={device.id} device={device} />)
                )}
            </div>

            {/* Section 3: Tier 3 - Default Fallback Tier */}
            <FallbackTierPool
                tierScope="default_fallback"
                title="Default Fallback Tier"
                tierBadge="Tier 3: Global Fallback"
                description="Company-wide default fallback tier for all incoming calls across every line. If the lead owner and line agents are unavailable or pass, calls route here before escalating to admins."
                emptyStateMessage="No default fallback users assigned. Unanswered calls will advance directly to the Admin Fallback Tier."
                addLabel="Add user to default fallback tier"
                placeholder="Search active users and managers"
            />

            {/* Section 4: Tier 4 - Admin Fallback Tier */}
            <FallbackTierPool
                tierScope="admin_fallback"
                title="Admin Fallback Tier"
                tierBadge="Tier 4: Admin Escalation"
                description="Users on this list receive calls if neither the lead owner, line agents, nor the default fallback tier answer. Only users with the admin role can be added to this list."
                emptyStateMessage="No administrators assigned. Calls will not escalate to admins unless they are added to this list."
                addLabel="Add admin to fallback tier"
                placeholder="Search active administrators"
            />
        </div>
    );
}

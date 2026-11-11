import React, { useEffect, useState } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { Tooltip, message } from "antd";
import useTranslation from "@/Hooks/useTranslation";

interface AgentCallAvailabilityToggleProps {
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Global application header control allowing agents to toggle their availability for incoming calls.
 * Tied to users.can_receive_calls and synced across the application and softphone dock.
 *
 * Spec:
 * - Single <button role="switch" aria-checked> pill, with whole pill clickable
 * - Size: height 44px, padding 0 8px 0 14px, fully rounded, no border, gap 10px, font 13px / 600
 * - Contents: status dot (8px circle), label text, visual switch track (36×22px with 16px white knob 3px from edge)
 * - Ready state: label "Ready for calls", background #e6f6ef, text #0b6b4f, dot #16a36f, track #0b6b4f, knob on right
 * - Paused state: label "Calls paused", background #f3f4f6, text #4b5563, dot #9ca3af, track #9ca3af, knob on left
 * - No phone icon, no glow, no border. Primary accent in the header.
 */
export default function AgentCallAvailabilityToggle({
    className,
    style,
}: AgentCallAvailabilityToggleProps) {
    const { t } = useTranslation();
    const { props } = usePage<any>();

    // Softphone must be enabled for the company
    const isSoftphoneEnabled = props.featureFlags?.["crm.softphone"] ?? false;

    const initialCanReceive = Boolean(props.auth?.user?.can_receive_calls ?? true);
    const [canReceive, setCanReceive] = useState<boolean>(initialCanReceive);
    const [loading, setLoading] = useState<boolean>(false);

    // Sync from Inertia page auth updates
    useEffect(() => {
        if (typeof props.auth?.user?.can_receive_calls === "boolean") {
            setCanReceive(props.auth.user.can_receive_calls);
        }
    }, [props.auth?.user?.can_receive_calls]);

    // Cross-component sync (e.g. if toggled from the Softphone dock)
    useEffect(() => {
        const onAvailabilityChanged = (event: Event) => {
            const ce = event as CustomEvent<{ can_receive_calls: boolean }>;
            if (typeof ce.detail?.can_receive_calls === "boolean") {
                setCanReceive(ce.detail.can_receive_calls);
            }
        };
        window.addEventListener("softphone:availability-changed", onAvailabilityChanged);
        return () => window.removeEventListener("softphone:availability-changed", onAvailabilityChanged);
    }, []);

    if (!isSoftphoneEnabled) {
        return null;
    }

    const handleToggle = async (e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (loading) return;

        const nextValue = !canReceive;
        setCanReceive(nextValue);
        setLoading(true);

        try {
            await axios.post(
                route("telephony.softphone.toggle-receive-calls"),
                { can_receive_calls: nextValue },
                { headers: { Accept: "application/json" } },
            );

            if (props.auth?.user) {
                (props.auth.user as any).can_receive_calls = nextValue;
            }

            window.dispatchEvent(
                new CustomEvent("softphone:availability-changed", {
                    detail: { can_receive_calls: nextValue },
                }),
            );

            if (nextValue) {
                void message.success(t("pages.softphone.availability_updated_active"));
            } else {
                void message.info(t("pages.softphone.availability_updated_paused"));
            }
        } catch {
            setCanReceive(!nextValue); // rollback on error
            void message.error("Could not update incoming call availability.");
        } finally {
            setLoading(false);
        }
    };

    const tooltipText = canReceive
        ? t("pages.softphone.incoming_calls_active_tooltip")
        : t("pages.softphone.incoming_calls_paused_tooltip");

    const labelText = canReceive ? "Ready for calls" : "Calls paused";

    // Theme values according to spec:
    // Ready state: bg #e6f6ef, text #0b6b4f, dot #16a36f, track #0b6b4f, knob on right (translateX(14px))
    // Paused state: bg #f3f4f6, text #4b5563, dot #9ca3af, track #9ca3af, knob on left (translateX(0px))
    const backgroundColor = canReceive ? "#e6f6ef" : "#f3f4f6";
    const textColor = canReceive ? "#0b6b4f" : "#4b5563";
    const dotColor = canReceive ? "#16a36f" : "#9ca3af";
    const trackColor = canReceive ? "#0b6b4f" : "#9ca3af";

    return (
        <Tooltip title={tooltipText}>
            <button
                type="button"
                role="switch"
                aria-checked={canReceive}
                aria-label={labelText}
                disabled={loading}
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        void handleToggle(e);
                    }
                }}
                className={`agent-call-availability-toggle ${className || ""}`}
                style={{
                    height: "44px",
                    padding: "0 8px 0 14px",
                    borderRadius: "9999px",
                    border: "none",
                    gap: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    backgroundColor,
                    color: textColor,
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: loading ? "wait" : "pointer",
                    userSelect: "none",
                    outline: "none",
                    transition: "background-color 0.2s ease, color 0.2s ease",
                    boxShadow: "none",
                    ...style,
                }}
            >
                {/* Status Dot: 8px circle */}
                <span
                    data-testid="call-status-dot"
                    style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: dotColor,
                        flexShrink: 0,
                        transition: "background-color 0.2s ease",
                    }}
                    aria-hidden="true"
                />

                {/* Label Text: 13px / 600 */}
                <span
                    data-testid="call-status-label"
                    style={{
                        whiteSpace: "nowrap",
                        lineHeight: 1,
                    }}
                >
                    {labelText}
                </span>

                {/* Visual Switch Track: 36×22px, rounded, with 16px white knob 3px from edge */}
                <span
                    data-testid="call-switch-track"
                    style={{
                        position: "relative",
                        width: "36px",
                        height: "22px",
                        borderRadius: "9999px",
                        backgroundColor: trackColor,
                        flexShrink: 0,
                        transition: "background-color 0.2s ease",
                        display: "inline-block",
                    }}
                    aria-hidden="true"
                >
                    {/* Knob: 16px white circle, 3px from top/edges */}
                    <span
                        data-testid="call-switch-knob"
                        style={{
                            position: "absolute",
                            top: "3px",
                            left: "3px",
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            transform: canReceive ? "translateX(14px)" : "translateX(0)",
                            transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    />
                </span>
            </button>
        </Tooltip>
    );
}

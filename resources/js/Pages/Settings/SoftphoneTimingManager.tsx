import React, { useState } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { SoundOutlined } from "@ant-design/icons";
import { App, Input, InputNumber } from "antd";
import Switch from "@/Components/Redesign/primitives/Switch";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { PoolResponse } from "./SoftphoneCallPool/types";
import VoicemailAudioUploader from "./SoftphoneCallPool/components/VoicemailAudioUploader";

import "@/Components/Redesign/redesign.css";
import "./CallBridgeSettings.css";

interface SoftphoneTimingManagerProps {
    initialFallbackSeconds?: number;
}

/**
 * Call Rotation & Timing manager panel:
 * - Time between calls (ring duration before routing advances across tiers)
 * - Voicemail Audio Greeting Uploader & Feature Toggle
 * - Automated Voice Message fallback settings (text, repeat count, custom audio URL)
 */
export default function SoftphoneTimingManager({
    initialFallbackSeconds = 20,
}: SoftphoneTimingManagerProps) {
    const { message } = App.useApp();
    const [savedFallbackSeconds, setSavedFallbackSeconds] = useState<number>(initialFallbackSeconds);
    const [secondsInput, setSecondsInput] = useState<string>(String(initialFallbackSeconds));
    const [secondsError, setSecondsError] = useState<string | null>(null);

    // Fallback Voice Message settings
    const [voiceMessageEnabled, setVoiceMessageEnabled] = useState<boolean>(false);
    const [voiceMessageText, setVoiceMessageText] = useState<string>(
        "We are unable to take your call at this time. Please try again later.",
    );
    const [voiceMessageUrl, setVoiceMessageUrl] = useState<string>("");
    const [voiceMessageRepeatCount, setVoiceMessageRepeatCount] = useState<number>(1);
    const [voiceMessageFlagEnabled, setVoiceMessageFlagEnabled] = useState<boolean>(true);
    const [isTogglingVoicemail, setIsTogglingVoicemail] = useState<boolean>(false);
    const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

    const settingsQuery = useApiQuery<PoolResponse>({
        path: route("telephony.softphone.call-pool.index", { scope: "default_fallback" }),
    });

    React.useEffect(() => {
        if (!settingsQuery.data?.data) return;
        const config = settingsQuery.data.data;

        if (typeof config.fallback_seconds === "number") {
            setSavedFallbackSeconds(config.fallback_seconds);
            setSecondsInput(String(config.fallback_seconds));
        }
        if (typeof config.fallback_voice_message_enabled === "boolean") {
            setVoiceMessageEnabled(config.fallback_voice_message_enabled);
        }
        if (config.fallback_voice_message_text) {
            setVoiceMessageText(config.fallback_voice_message_text);
        }
        if (config.fallback_voice_message_url) {
            setVoiceMessageUrl(config.fallback_voice_message_url);
        }
        if (typeof config.fallback_voice_message_repeat_count === "number") {
            setVoiceMessageRepeatCount(config.fallback_voice_message_repeat_count);
        }
        if (typeof config.voice_message_flag_enabled === "boolean") {
            setVoiceMessageFlagEnabled(config.voice_message_flag_enabled);
        }
    }, [settingsQuery.data]);

    const { props: pageProps } = usePage<any>();
    const isVoicemailFlagEnabled =
        pageProps?.featureFlags?.["softphone.voicemail"] ?? voiceMessageFlagEnabled;

    const parsedSeconds = Number.parseInt(secondsInput, 10);
    const isValidSeconds = Number.isFinite(parsedSeconds) && parsedSeconds >= 1 && parsedSeconds <= 600;

    const handleToggleVoicemail = async (nextState?: boolean) => {
        const next = typeof nextState === "boolean" ? nextState : !voiceMessageEnabled;
        setVoiceMessageEnabled(next);
        setIsTogglingVoicemail(true);
        try {
            const response = await axios.post<{
                status: string;
                message: string;
                fallback_voice_message_enabled: boolean;
            }>(
                route("telephony.softphone.toggle-voicemail"),
                { enabled: next },
                { headers: { Accept: "application/json" } },
            );
            void message.success(
                response.data?.message || (next ? "Voicemail feature turned on." : "Voicemail feature turned off."),
            );
            await settingsQuery.refetch();
        } catch (error: any) {
            setVoiceMessageEnabled(!next);
            const serverMessage =
                error?.response?.data?.message || "Failed to update voicemail feature status.";
            void message.error(serverMessage);
        } finally {
            setIsTogglingVoicemail(false);
        }
    };

    const handleSaveGlobalSettings = async () => {
        setSecondsError(null);
        if (!isValidSeconds) {
            const errorMessage = "Enter a valid time between calls (1–600 seconds).";
            setSecondsError(errorMessage);
            void message.error(errorMessage);
            return;
        }
        setIsSavingSettings(true);
        try {
            const response = await axios.post<{
                status?: string;
                data?: {
                    fallback_seconds?: number;
                    fallback_voice_message_enabled?: boolean;
                    fallback_voice_message_repeat_count?: number;
                    fallback_voice_message_text?: string;
                    fallback_voice_message_url?: string;
                };
            }>(
                route("telephony.softphone.call-pool.store"),
                {
                    incoming_call_fallback_seconds: parsedSeconds,
                    fallback_voice_message_enabled: voiceMessageEnabled,
                    fallback_voice_message_repeat_count: voiceMessageRepeatCount,
                    fallback_voice_message_text: voiceMessageText,
                    fallback_voice_message_url: voiceMessageUrl.trim() || null,
                },
                { headers: { Accept: "application/json" } },
            );
            const updated = response.data?.data;
            if (updated?.fallback_seconds) {
                setSavedFallbackSeconds(updated.fallback_seconds);
                setSecondsInput(String(updated.fallback_seconds));
            }
            if (updated?.fallback_voice_message_enabled !== undefined) {
                setVoiceMessageEnabled(updated.fallback_voice_message_enabled);
            }
            if (updated?.fallback_voice_message_repeat_count !== undefined) {
                setVoiceMessageRepeatCount(updated.fallback_voice_message_repeat_count);
            }
            void message.success("Telephony timing and fallback settings saved.");
            await settingsQuery.refetch();
        } catch (error: any) {
            const serverMessage =
                error?.response?.data?.message || "Could not update telephony settings.";
            setSecondsError(serverMessage);
            void message.error(serverMessage);
        } finally {
            setIsSavingSettings(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div
                style={{
                    padding: "20px",
                    background: "var(--dr-surface)",
                    border: "1px solid var(--dr-border)",
                    borderRadius: "var(--cb-radius)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                }}
            >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--dr-text)" }}>
                            Call Rotation & Timing
                        </h3>
                        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--dr-text-muted)" }}>
                            Configure ring duration before advancing across tiers: Lead Owner → Line Pool → Default Fallback → Admin Fallback.
                        </p>
                    </div>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                        <label htmlFor="cb-fallback-seconds" style={{ fontSize: "13px", fontWeight: 500, color: "var(--dr-text)" }}>
                            Time between calls:
                        </label>
                        <input
                            id="cb-fallback-seconds"
                            type="number"
                            min={1}
                            max={600}
                            className="cb-input cb-num"
                            style={{ width: "80px" }}
                            value={secondsInput}
                            onChange={(e) => {
                                setSecondsInput(e.target.value);
                                setSecondsError(null);
                            }}
                        />
                        <span style={{ fontSize: "13px", color: "var(--dr-text-muted)" }}>seconds</span>
                    </div>
                </div>

                {secondsError && (
                    <span role="alert" style={{ fontSize: "12px", color: "var(--dr-red, #dc2626)" }}>
                        {secondsError}
                    </span>
                )}

                {/* Ungated Voicemail Audio Greeting Uploader & Live Feature Toggle */}
                <VoicemailAudioUploader
                    audioUrl={voiceMessageUrl}
                    onAudioChanged={(newUrl) => {
                        setVoiceMessageUrl(newUrl ?? "");
                        void settingsQuery.refetch();
                    }}
                    isEnabled={voiceMessageEnabled}
                    onToggleEnabled={handleToggleVoicemail}
                    isTogglingEnabled={isTogglingVoicemail}
                />

                {isVoicemailFlagEnabled && (
                    <div
                        style={{
                            padding: "16px",
                            background: "var(--dr-surface-2, #f8fafc)",
                            border: "1px solid var(--dr-border, #e2e8f0)",
                            borderRadius: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "14px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <SoundOutlined style={{ fontSize: "18px", color: "var(--dr-blue, #1677ff)" }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--dr-text)" }}>
                                        Automated Voice Message Fallback
                                    </div>
                                    <div style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>
                                        When no one is available or all fallback tiers pass or time out, play an automated message for the caller and terminate the call.
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                <Switch
                                    checked={voiceMessageEnabled}
                                    loading={isTogglingVoicemail}
                                    onChange={() => void handleToggleVoicemail(!voiceMessageEnabled)}
                                    aria-label="Toggle automated voice message fallback"
                                />
                                <span style={{ fontSize: "13px", fontWeight: 500, color: voiceMessageEnabled ? "var(--dr-green, #10b981)" : "var(--dr-text-muted)" }}>
                                    {voiceMessageEnabled ? "Enabled" : "Disabled"}
                                </span>
                            </div>
                        </div>

                        {voiceMessageEnabled && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
                                <div>
                                    <label htmlFor="cb-voice-message-text" style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                                        Voice Message Content (Spoken to caller)
                                    </label>
                                    <Input.TextArea
                                        id="cb-voice-message-text"
                                        rows={2}
                                        value={voiceMessageText}
                                        onChange={(e) => setVoiceMessageText(e.target.value)}
                                        placeholder="e.g. We are unable to take your call at this time. Please try again later."
                                        maxLength={500}
                                    />
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                        <label htmlFor="cb-voice-repeat-count" style={{ fontSize: "12px", fontWeight: 600 }}>
                                            Repeat count before ending call:
                                        </label>
                                        <InputNumber
                                            id="cb-voice-repeat-count"
                                            min={1}
                                            max={5}
                                            value={voiceMessageRepeatCount}
                                            onChange={(val) => setVoiceMessageRepeatCount(val ?? 1)}
                                            style={{ width: "70px" }}
                                        />
                                        <span style={{ fontSize: "12px", color: "var(--dr-text-muted)" }}>times</span>
                                    </div>

                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "240px" }}>
                                        <label htmlFor="cb-voice-url" style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }}>
                                            Custom Audio URL (Optional):
                                        </label>
                                        <Input
                                            id="cb-voice-url"
                                            size="small"
                                            value={voiceMessageUrl}
                                            onChange={(e) => setVoiceMessageUrl(e.target.value)}
                                            placeholder="https://.../greeting.mp3 (leave empty for synthesized speech)"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        className="cb-btn cb-btn--primary"
                        disabled={isSavingSettings}
                        onClick={() => void handleSaveGlobalSettings()}
                    >
                        {isSavingSettings ? "Saving Settings…" : "Save Timing & Fallback Settings"}
                    </button>
                </div>
            </div>
        </div>
    );
}

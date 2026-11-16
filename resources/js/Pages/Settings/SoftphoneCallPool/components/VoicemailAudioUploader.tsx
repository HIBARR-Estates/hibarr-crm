import React, { useRef, useState } from "react";
import axios from "axios";
import { App } from "antd";
import {
    DeleteOutlined,
    InfoCircleOutlined,
    SoundOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import Switch from "@/Components/Redesign/primitives/Switch";

interface VoicemailAudioUploaderProps {
    audioUrl: string;
    onAudioChanged: (newUrl: string | null) => void;
    isEnabled?: boolean;
    onToggleEnabled?: (enabled: boolean) => void;
    isTogglingEnabled?: boolean;
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Ungated Voicemail Audio Greeting Uploader & Live Feature Toggle for Call Bridge settings.
 */
export default function VoicemailAudioUploader({
    audioUrl,
    onAudioChanged,
    isEnabled,
    onToggleEnabled,
    isTogglingEnabled,
}: VoicemailAudioUploaderProps) {
    const { message } = App.useApp();
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_AUDIO_BYTES) {
            void message.error("Audio file size must be less than 10MB.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        setIsUploading(true);
        try {
            const response = await axios.post<{
                status: string;
                message: string;
                fallback_voice_message_url: string;
            }>(route("telephony.softphone.upload-voicemail"), formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Accept: "application/json",
                },
            });

            const uploadedUrl = response.data?.fallback_voice_message_url;
            onAudioChanged(uploadedUrl);
            void message.success(response.data?.message || "Voicemail audio greeting uploaded.");
        } catch (error: any) {
            const serverMessage =
                error?.response?.data?.message || "Failed to upload voicemail audio file.";
            void message.error(serverMessage);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDeleteAudio = async () => {
        setIsDeleting(true);
        try {
            const response = await axios.delete<{
                status: string;
                message: string;
            }>(route("telephony.softphone.voicemail-file.destroy"), {
                headers: { Accept: "application/json" },
            });
            onAudioChanged(null);
            void message.success(response.data?.message || "Voicemail audio file removed.");
        } catch (error: any) {
            const serverMessage =
                error?.response?.data?.message || "Failed to remove voicemail audio file.";
            void message.error(serverMessage);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div
            style={{
                padding: "16px",
                background: "var(--dr-surface-2, #f8fafc)",
                border: "1px solid var(--dr-border, #e2e8f0)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                }}
            >
                <div>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            fontWeight: 600,
                            fontSize: "14px",
                            color: "var(--dr-text)",
                        }}
                    >
                        <SoundOutlined style={{ color: "var(--dr-blue, #1677ff)" }} />
                        <span>Voicemail Feature & Audio</span>
                        <span
                            style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                padding: "1px 8px",
                                borderRadius: "999px",
                                background: "var(--dr-surface-3, #e2e8f0)",
                                color: "var(--dr-text-muted)",
                            }}
                        >
                            Tier 4 Fallback
                        </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--dr-text-muted)", marginTop: "2px" }}>
                        Play a pre-recorded greeting or voice message when calls go unanswered across all fallback tiers.
                    </div>
                </div>

                <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {onToggleEnabled && (
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "3px 12px",
                                borderRadius: "999px",
                                background: isEnabled ? "rgba(16, 185, 129, 0.12)" : "var(--dr-surface-3, #f1f5f9)",
                                border: isEnabled ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--dr-border, #cbd5e1)",
                            }}
                        >
                            <Switch
                                checked={Boolean(isEnabled)}
                                onChange={() => onToggleEnabled(!isEnabled)}
                                loading={isTogglingEnabled}
                                aria-label="Toggle voicemail feature"
                            />
                            <span
                                style={{
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: isEnabled ? "var(--dr-green, #10b981)" : "var(--dr-text-muted, #64748b)",
                                    cursor: "pointer",
                                }}
                                onClick={() => !isTogglingEnabled && onToggleEnabled(!isEnabled)}
                            >
                                {isEnabled ? "Voicemail ON" : "Voicemail OFF"}
                            </span>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/aac,audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                        style={{ display: "none" }}
                        onChange={(e) => void handleFileSelected(e)}
                    />
                    <button
                        type="button"
                        className="cb-btn cb-btn--secondary"
                        disabled={isUploading || isDeleting}
                        onClick={() => fileInputRef.current?.click()}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 14px" }}
                    >
                        <UploadOutlined />
                        <span>{isUploading ? "Uploading…" : audioUrl ? "Replace Audio File" : "Upload Audio File"}</span>
                    </button>
                    {audioUrl && (
                        <button
                            type="button"
                            className="cb-btn cb-btn--danger"
                            disabled={isUploading || isDeleting}
                            onClick={() => void handleDeleteAudio()}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 12px" }}
                            title="Remove audio greeting"
                        >
                            <DeleteOutlined />
                            <span>{isDeleting ? "Removing…" : "Remove"}</span>
                        </button>
                    )}
                </div>
            </div>

            {audioUrl ? (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "12px",
                        padding: "10px 14px",
                        background: "var(--dr-surface, #ffffff)",
                        border: "1px solid var(--dr-border, #e2e8f0)",
                        borderRadius: "6px",
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "200px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--dr-text)" }}>
                            Current Audio File
                        </span>
                        <a
                            href={audioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                fontSize: "11px",
                                color: "var(--dr-blue, #1677ff)",
                                textDecoration: "underline",
                                wordBreak: "break-all",
                                maxWidth: "340px",
                            }}
                        >
                            {audioUrl.split("/").pop() || "Audio File"}
                        </a>
                    </div>

                    <audio
                        controls
                        preload="metadata"
                        src={audioUrl}
                        style={{ height: "36px", maxWidth: "380px", flex: "1 1 260px" }}
                    >
                        Your browser does not support the audio element.
                    </audio>
                </div>
            ) : (
                <div
                    style={{
                        padding: "10px 14px",
                        background: "var(--dr-surface, #ffffff)",
                        border: "1px dashed var(--dr-border, #cbd5e1)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "var(--dr-text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <InfoCircleOutlined style={{ color: "var(--dr-blue, #1677ff)" }} />
                    <span>No audio file uploaded yet. Click &ldquo;Upload Audio File&rdquo; to add a recording (MP3, WAV, OGG, max 10MB).</span>
                </div>
            )}

            {!isEnabled && (
                <div
                    style={{
                        padding: "8px 12px",
                        background: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "var(--dr-text, #334155)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <InfoCircleOutlined style={{ color: "#d97706" }} />
                    <span>
                        Voicemail feature is currently turned off. Calls that are unanswered across all fallback tiers will disconnect without playing a voice greeting. Toggle ON above to activate voicemail fallback.
                    </span>
                </div>
            )}
        </div>
    );
}

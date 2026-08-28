import type { CSSProperties } from "react";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import Switch from "@/Components/Redesign/primitives/Switch";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { NOTCH_DURATIONS_MS, type NotchPosition } from "@/lib/notificationAlerts";
import { useNotificationAlertSettings } from "@/contexts/NotificationAlertSettingsContext";

const POSITIONS: { value: NotchPosition; label: string }[] = [
    { value: "top-left", label: "Top left" },
    { value: "top-center", label: "Top centre" },
    { value: "top-right", label: "Top right" },
    { value: "bottom-left", label: "Bottom left" },
    { value: "bottom-center", label: "Bottom centre" },
    { value: "bottom-right", label: "Bottom right" },
];

export default function InAppAlertPreferences() {
    const { td } = useTd();
    const {
        settings: {
            notch_position: position,
            notch_duration_ms: durationMs,
            alerts_muted: alertsMuted,
        },
        setNotchPosition,
        setNotchDurationMs,
        setAlertsMuted,
    } = useNotificationAlertSettings();

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                    gap: 12,
                }}
            >
                <span
                    style={{
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT,
                    }}
                >
                    {td("Mute in-app alert toasts", { source: "en" })}
                </span>
                <Switch
                    checked={alertsMuted}
                    onChange={() => setAlertsMuted(!alertsMuted)}
                    aria-label={td("Mute in-app alert toasts", { source: "en" })}
                />
            </div>

            <div
                style={{
                    fontSize: REDESIGN_TYPE.CAPTION,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: T.GRAY_DARKER,
                    marginBottom: 8,
                }}
            >
                {td("Notification position", { source: "en" })}
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                }}
            >
                {POSITIONS.map((p) => {
                    const selected = position === p.value;
                    return (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() => setNotchPosition(p.value)}
                            style={{
                                appearance: "none",
                                fontFamily: "inherit",
                                background: T.WHITE,
                                border: `1px solid ${selected ? T.NAVY : T.BORDER}`,
                                borderRadius: 8,
                                padding: "8px 8px 8px",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
                            <span
                                style={{
                                    position: "relative",
                                    width: "100%",
                                    height: 28,
                                    borderRadius: 5,
                                    background: selected ? T.NAVY_SOFT : T.BG,
                                }}
                            >
                                <span
                                    style={{
                                        position: "absolute",
                                        width: 18,
                                        height: 5,
                                        borderRadius: 3,
                                        background: selected ? T.NAVY : T.NAVY_MID,
                                        ...positionBarStyle(p.value),
                                    }}
                                />
                            </span>
                            <span
                                style={{
                                    fontSize: REDESIGN_TYPE.CAPTION,
                                    fontWeight: selected ? 600 : 500,
                                    color: selected ? T.TEXT : T.TEXT_MUTED,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {td(p.label, { source: "en" })}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div
                style={{
                    fontSize: REDESIGN_TYPE.CAPTION,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: T.GRAY_DARKER,
                    margin: "16px 0 8px",
                }}
            >
                {td("Stay on screen for", { source: "en" })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                {NOTCH_DURATIONS_MS.map((ms) => {
                    const selected = durationMs === ms;
                    return (
                        <button
                            key={ms}
                            type="button"
                            onClick={() => setNotchDurationMs(ms)}
                            style={{
                                appearance: "none",
                                flex: 1,
                                fontFamily: "inherit",
                                fontSize: REDESIGN_TYPE.CAPTION,
                                fontWeight: selected ? 600 : 500,
                                padding: "8px 10px",
                                borderRadius: 999,
                                cursor: "pointer",
                                background: selected ? T.NAVY : T.WHITE,
                                color: selected ? T.WHITE : T.TEXT_MUTED,
                                border: `1px solid ${selected ? T.NAVY : T.BORDER}`,
                                minHeight: 32,
                            }}
                        >
                            {ms / 1000}s
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function positionBarStyle(position: NotchPosition): CSSProperties {
    const isTop = position.indexOf("top") === 0;
    const isLeft = position.indexOf("left") > 0;
    const isRight = position.indexOf("right") > 0;
    const style: CSSProperties = isTop ? { top: 4 } : { bottom: 4 };
    if (isLeft) style.left = 4;
    else if (isRight) style.right = 4;
    else {
        style.left = "50%";
        style.transform = "translateX(-50%)";
    }
    return style;
}

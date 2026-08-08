import type { CSSProperties } from "react";
import { useState } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    getNotchDurationMs,
    getNotchPosition,
    setNotchDurationMs,
    setNotchPosition,
    type NotchPosition,
} from "@/lib/notificationAlerts";

const POSITIONS: { value: NotchPosition; label: string }[] = [
    { value: "top-left", label: "Top left" },
    { value: "top-center", label: "Top centre" },
    { value: "top-right", label: "Top right" },
    { value: "bottom-left", label: "Bottom left" },
    { value: "bottom-center", label: "Bottom centre" },
    { value: "bottom-right", label: "Bottom right" },
];

const DURATIONS = [3000, 4200, 6000];

/** Position + dismiss timing for in-app alert toasts (top of notification dropdown). */
export default function NotificationAlertSettings() {
    const { td } = useTd();
    const [position, setPositionState] = useState<NotchPosition>(() =>
        getNotchPosition(),
    );
    const [durationMs, setDurationMsState] = useState(() =>
        getNotchDurationMs(),
    );

    return (
        <div style={{ width: 280 }} onClick={(e) => e.stopPropagation()}>
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: T.GRAY_DARKER,
                    marginBottom: 8,
                }}
            >
                {td("Notification position")}
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
                            onClick={() => {
                                setNotchPosition(p.value);
                                setPositionState(p.value);
                            }}
                            style={{
                                appearance: "none",
                                fontFamily: "inherit",
                                background: T.WHITE,
                                border: `1px solid ${selected ? T.NAVY : T.BORDER}`,
                                borderRadius: 8,
                                padding: "7px 6px 6px",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 5,
                            }}
                        >
                            <span
                                style={{
                                    position: "relative",
                                    width: "100%",
                                    height: 26,
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
                                        background: selected
                                            ? T.NAVY
                                            : T.NAVY_MID,
                                        ...positionBarStyle(p.value),
                                    }}
                                />
                            </span>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: selected ? 600 : 500,
                                    color: selected ? T.TEXT : T.TEXT_MUTED,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {td(p.label)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: T.GRAY_DARKER,
                    margin: "14px 0 8px",
                }}
            >
                {td("Stay on screen for")}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
                {DURATIONS.map((ms) => {
                    const selected = durationMs === ms;
                    return (
                        <button
                            key={ms}
                            type="button"
                            onClick={() => {
                                setNotchDurationMs(ms);
                                setDurationMsState(ms);
                            }}
                            style={{
                                appearance: "none",
                                flex: 1,
                                fontFamily: "inherit",
                                fontSize: 12,
                                fontWeight: selected ? 600 : 500,
                                padding: "6px 8px",
                                borderRadius: 999,
                                cursor: "pointer",
                                background: selected ? T.NAVY : T.WHITE,
                                color: selected ? T.WHITE : T.TEXT_MUTED,
                                border: `1px solid ${selected ? T.NAVY : T.BORDER}`,
                                minHeight: 28,
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

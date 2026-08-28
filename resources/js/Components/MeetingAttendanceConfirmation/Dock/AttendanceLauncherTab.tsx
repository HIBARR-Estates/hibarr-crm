import { useEffect } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { ensureDockAnimationsInjected } from "./dockAnimations";

interface AttendanceLauncherTabProps {
    count: number;
    onOpen: () => void;
}

/** Minimized right-edge tab that opens the reminders dock. */
export default function AttendanceLauncherTab({
    count,
    onOpen,
}: AttendanceLauncherTabProps) {
    const { td } = useTd();

    useEffect(() => {
        ensureDockAnimationsInjected();
    }, []);

    return (
        <button
            type="button"
            onClick={onOpen}
            title={td("Meeting check-ins", { source: "en" })}
            className="hb-attendance-tab"
            style={{
                position: "fixed",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 40,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "12px 7px",
                border: "1px solid #003160",
                borderRight: "none",
                borderRadius: "12px 0 0 12px",
                cursor: "pointer",
                background: "#003160",
                color: "#ffffff",
            }}
        >
            <span
                style={{
                    position: "relative",
                    display: "flex",
                    color: "#ffffff",
                }}
            >
                <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                <span
                    className="hb-attendance-tab-badge"
                    style={{
                        position: "absolute",
                        top: -5,
                        right: -6,
                        minWidth: 14,
                        height: 14,
                        padding: "0 3px",
                        borderRadius: 999,
                        background: "#b91c1c",
                        color: "#ffffff",
                        fontSize: 9,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1.5px solid #ffffff",
                    }}
                >
                    {count}
                </span>
            </span>
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                }}
            >
                {td("Check-ins", { source: "en" })}
            </span>
        </button>
    );
}

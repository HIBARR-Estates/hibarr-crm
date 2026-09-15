import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { hardRefresh, startStaleBuildWatcher } from "@/lib/staleBuildCheck";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";

const BANNER_Z_INDEX = 1450;

export default function StaleBuildBanner() {
    const { td } = useTd();
    const page = usePage();
    const bootIdRef = useRef<string | null | undefined>(page.props.appBuildId);
    const [stale, setStale] = useState(false);

    useEffect(() => {
        return startStaleBuildWatcher({
            bootId: bootIdRef.current,
            onStale: () => setStale(true),
        });
    }, []);

    if (!stale || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div
            role="status"
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: BANNER_Z_INDEX,
                background: T.AMBER_BG,
                color: T.AMBER_TEXT,
                borderBottom: `1px solid ${T.AMBER_BORDER}`,
                padding: "10px 16px",
                fontFamily: REDESIGN_FONT_STACK,
                fontSize: REDESIGN_TYPE.BODY,
                fontWeight: 500,
                lineHeight: 1.4,
                textAlign: "center",
            }}
        >
            {td("A new version of the application is available.", {
                source: "en",
            })}{" "}
            <button
                type="button"
                onClick={() => {
                    void hardRefresh();
                }}
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: T.AMBER_TEXT,
                    font: "inherit",
                    textDecoration: "underline",
                    cursor: "pointer",
                }}
            >
                {td("Refresh now", { source: "en" })}
            </button>
        </div>,
        document.body,
    );
}

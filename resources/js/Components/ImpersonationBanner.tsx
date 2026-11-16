import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";

/**
 * Full-width strip while an admin is signed in as an employee. Rendered
 * above every Inertia page so the way back stays on screen.
 */
export default function ImpersonationBanner() {
    const { t } = useTranslation();
    const [leaving, setLeaving] = useState(false);
    const { impersonation, auth } = usePage().props as {
        impersonation?: { active?: boolean } | null;
        auth?: { user?: { name?: string | null } | null };
    };

    if (!impersonation) {
        return null;
    }

    const name = auth?.user?.name ?? "";

    return (
        <div
            role="status"
            style={{
                position: "sticky",
                top: 0,
                zIndex: 1460,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                flexWrap: "wrap",
                background: T.AMBER_BG,
                color: T.AMBER_TEXT,
                borderBottom: `1px solid ${T.AMBER_BORDER}`,
                padding: "10px 16px",
                fontFamily: REDESIGN_FONT_STACK,
                fontSize: REDESIGN_TYPE.BODY,
                fontWeight: 500,
                lineHeight: 1.4,
            }}
        >
            <span>{t("app.impersonation.signedInAs", { name })}</span>
            <button
                type="button"
                disabled={leaving}
                onClick={() => {
                    setLeaving(true);
                    router.post(
                        route("impersonation.leave"),
                        {},
                        { onFinish: () => setLeaving(false) },
                    );
                }}
                style={{
                    background: T.AMBER_TEXT,
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 12px",
                    font: "inherit",
                    fontWeight: 600,
                    cursor: leaving ? "wait" : "pointer",
                }}
            >
                {t("app.impersonation.return")}
            </button>
        </div>
    );
}

import { Icon } from "@/Components/Redesign";
import ProgressRing from "@/Components/Redesign/primitives/ProgressRing";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { LIFECYCLE_BANNER_CONFIG } from "../../config/lifecycleBanners";
import type { LeadBannerMode } from "../../types";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

interface LifecycleBannerProps {
    mode: LeadBannerMode;
    statusLabel: string;
    statusKey: string;
    firstName: string;
    description?: string;
    templateName?: string | null;
    answered?: number;
    total?: number;
    dealCount?: number;
    /** True while a qualification call is being started/resumed. */
    busy?: boolean;
    onPrimary: () => void;
    onSecondary?: () => void;
    onViewAnswers?: () => void;
}

export default function LifecycleBanner({
    mode,
    statusLabel,
    statusKey,
    firstName,
    description,
    templateName,
    answered = 0,
    total = 0,
    dealCount = 0,
    busy = false,
    onPrimary,
    onSecondary,
    onViewAnswers,
}: LifecycleBannerProps) {
    const { td } = useTd();
    const config = LIFECYCLE_BANNER_CONFIG[mode];
    const hint = description ?? "";
    const primaryLabel = busy
        ? td("Starting…", { source: "en" })
        : td(config.primaryCta.label, { source: "en" });

    if (mode === "qualified") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    background: "var(--dr-green-light)",
                    border: "1px solid var(--dr-green-mid)",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--dr-green)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--dr-white)",
                        flexShrink: 0,
                    }}
                >
                    <Icon name="check" size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                        style={{
                            fontWeight: 650,
                            fontSize: 14,
                            color: "#065f46",
                        }}
                    >
                        {td(statusLabel, { source: "en" })} — {templateName || td("buyer script", { source: "en" })} ·{" "}
                        {td("next: create a deal", { source: "en" })}
                    </div>
                    {onViewAnswers && (
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--dr-green)",
                                marginTop: 2,
                                display: "flex",
                                gap: 10,
                                alignItems: "center",
                                flexWrap: "wrap",
                            }}
                        >
                            <button
                                type="button"
                                onClick={onViewAnswers}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--dr-green)",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontFamily: "inherit",
                                    padding: 0,
                                    textDecoration: "underline",
                                }}
                            >
                                {td("view answers", { source: "en" })}
                            </button>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    className="v2-btn v2-btn-primary"
                    onClick={onPrimary}
                >
                    {td(config.primaryCta.label, { source: "en" })}
                </button>
            </div>
        );
    }

    if (mode === "converted") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    background: "var(--dr-teal-soft)",
                    border: "1px solid var(--dr-teal-mid)",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--dr-teal)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--dr-white)",
                        flexShrink: 0,
                    }}
                >
                    <Icon name="check" size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                        style={{
                            fontWeight: 650,
                            fontSize: 14,
                            color: "#115e59",
                        }}
                    >
                        {td(statusLabel, { source: "en" })} —{" "}
                        {dealCount > 1
                            ? td("deals linked from qualification", { source: "en" })
                            : td("deal linked from qualification", { source: "en" })}
                        {dealCount > 0
                            ? ` (${dealCount})`
                            : ""}
                    </div>
                    {hint ? (
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--dr-teal)",
                                marginTop: 2,
                            }}
                        >
                            {td(hint, { source: "en" })}
                        </div>
                    ) : null}
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                    }}
                >
                    {onSecondary && config.secondaryCta ? (
                        <button
                            type="button"
                            className="v2-btn v2-btn-ghost"
                            onClick={onSecondary}
                        >
                            {td(config.secondaryCta.label, { source: "en" })}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="v2-btn v2-btn-primary"
                        onClick={onPrimary}
                    >
                        {td(dealCount > 1
                                ? "Open latest deal"
                                : config.primaryCta.label, { source: "en" })}
                    </button>
                </div>
            </div>
        );
    }

    if (mode === "closed") {
        const isRed = statusKey === "not_fit";
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    background: "var(--dr-surface-2)",
                    border: "1px solid var(--dr-border)",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: isRed ? "var(--dr-red-soft)" : T.BORDER,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isRed ? "var(--dr-red)" : "var(--dr-text-muted)",
                        flexShrink: 0,
                    }}
                >
                    <Icon name="ban" size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                        style={{
                            fontWeight: 650,
                            fontSize: 14,
                            color: "var(--dr-text-muted)",
                        }}
                    >
                        {td(statusLabel, { source: "en" })} — {td(hint || "no further sales push", { source: "en" })}
                    </div>
                    {onViewAnswers && (
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--dr-text-hint)",
                                marginTop: 2,
                            }}
                        >
                            <button
                                type="button"
                                onClick={onViewAnswers}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--dr-text-muted)",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontFamily: "inherit",
                                    padding: 0,
                                    textDecoration: "underline",
                                }}
                            >
                                {td("view answers", { source: "en" })}
                            </button>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    className="v2-btn v2-btn-ghost"
                    onClick={onPrimary}
                >
                    {td(config.primaryCta.label, { source: "en" })}
                </button>
            </div>
        );
    }

    if (mode === "qualify_resume") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    background: "var(--dr-amber-banner)",
                    color: "#78350f",
                    border: "1px solid var(--dr-amber-border)",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <ProgressRing
                    done={answered}
                    total={total}
                    size={34}
                    color={T.NAVY}
                    trackColor="#ffffff66"
                />
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>
                        {td(statusLabel, { source: "en" })} — {answered} {td("of", { source: "en" })} {total}{" "}
                        {td("answered", { source: "en" })}
                    </div>
                    {templateName ? (
                        <div
                            style={{
                                fontSize: 12,
                                color: T.AMBER,
                                marginTop: 2,
                            }}
                        >
                            {templateName}
                        </div>
                    ) : null}
                </div>
                <button
                    type="button"
                    className="v2-btn v2-btn-solid"
                    disabled={busy}
                    style={busy ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    onClick={onPrimary}
                >
                    {primaryLabel}
                </button>
            </div>
        );
    }

    if (mode === "nurture") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    background: "var(--dr-purple-soft)",
                    border: "1px solid #ddd6fe",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <div style={{ flex: 1, minWidth: 220 }}>
                    <div
                        style={{
                            fontWeight: 650,
                            fontSize: 14,
                            color: "var(--dr-purple)",
                        }}
                    >
                        {td(statusLabel, { source: "en" })} — {firstName}
                    </div>
                    {hint ? (
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--dr-text-muted)",
                                marginTop: 2,
                            }}
                        >
                            {td(hint, { source: "en" })}
                        </div>
                    ) : null}
                </div>
                <button
                    type="button"
                    className="v2-btn v2-btn-ghost"
                    disabled={busy}
                    style={busy ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    onClick={onPrimary}
                >
                    {primaryLabel}
                </button>
            </div>
        );
    }

    const isFresh = statusKey === "new";
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                background: isFresh
                    ? "var(--dr-blue-light)"
                    : "linear-gradient(90deg, var(--dr-navy) 0%, var(--dr-blue) 100%)",
                border: isFresh ? "1px solid var(--dr-blue-mid)" : "none",
                borderRadius: 10,
                padding: "12px 16px",
                color: isFresh ? "var(--dr-text)" : "var(--dr-white)",
            }}
        >
            <div style={{ flex: 1, minWidth: 220 }}>
                <div
                    style={{
                        fontWeight: 650,
                        fontSize: 14,
                        color: isFresh ? "var(--dr-navy)" : "var(--dr-white)",
                    }}
                >
                    {td("Qualify", { source: "en" })} {firstName}
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: isFresh
                            ? "var(--dr-text-muted)"
                            : "rgba(255,255,255,0.75)",
                        marginTop: 2,
                    }}
                >
                    {td(statusLabel, { source: "en" })} · {td(hint || "choose a qualification template", { source: "en" })}
                </div>
            </div>
            <button
                type="button"
                className={isFresh ? "v2-btn v2-btn-primary" : "v2-btn"}
                disabled={busy}
                style={{
                    ...(isFresh
                        ? undefined
                        : { background: "var(--dr-white)", color: "var(--dr-navy)" }),
                    ...(busy ? { opacity: 0.6, cursor: "not-allowed" } : undefined),
                }}
                onClick={onPrimary}
            >
                {primaryLabel}
            </button>
        </div>
    );
}

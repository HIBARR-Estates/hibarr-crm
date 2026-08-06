import { Icon } from "@/Components/Redesign";
import ProgressRing from "@/Components/Redesign/primitives/ProgressRing";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { LIFECYCLE_BANNER_CONFIG } from "../../config/lifecycleBanners";
import type { LeadBannerMode } from "../../types";

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
    onPrimary,
    onSecondary,
    onViewAnswers,
}: LifecycleBannerProps) {
    const { td } = useTd();
    const config = LIFECYCLE_BANNER_CONFIG[mode];
    const hint = description ?? "";

    if (mode === "qualified") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    background: "var(--lr-green-light)",
                    border: "1px solid var(--lr-green-mid)",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--lr-green)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--lr-white)",
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
                                color: "var(--lr-green)",
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
                                    color: "var(--lr-green)",
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
                    background: "var(--lr-teal-soft)",
                    border: "1px solid #99e2d8",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--lr-teal)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--lr-white)",
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
                                color: "var(--lr-teal)",
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
                    background: "var(--lr-surface-2)",
                    border: "1px solid var(--lr-border)",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: isRed ? "var(--lr-red-soft)" : "#e5e7eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isRed ? "var(--lr-red)" : "var(--lr-text-muted)",
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
                            color: "var(--lr-text-muted)",
                        }}
                    >
                        {td(statusLabel, { source: "en" })} — {td(hint || "no further sales push", { source: "en" })}
                    </div>
                    {onViewAnswers && (
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--lr-text-dim)",
                                marginTop: 2,
                            }}
                        >
                            <button
                                type="button"
                                onClick={onViewAnswers}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--lr-text-muted)",
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
                    background: "var(--lr-amber-banner)",
                    color: "#78350f",
                    border: "1px solid #fde68a",
                    borderRadius: 10,
                    padding: "12px 16px",
                }}
            >
                <ProgressRing
                    done={answered}
                    total={total}
                    size={34}
                    color="#16294d"
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
                                color: "#92400e",
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
                    onClick={onPrimary}
                >
                    {td(config.primaryCta.label, { source: "en" })}
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
                    background: "var(--lr-purple-soft)",
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
                            color: "var(--lr-purple)",
                        }}
                    >
                        {td(statusLabel, { source: "en" })} — {firstName}
                    </div>
                    {hint ? (
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--lr-text-muted)",
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
                    onClick={onPrimary}
                >
                    {td(config.primaryCta.label, { source: "en" })}
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
                    ? "var(--lr-blue-light)"
                    : "linear-gradient(90deg, var(--lr-navy) 0%, var(--lr-blue) 100%)",
                border: isFresh ? "1px solid var(--lr-blue-mid)" : "none",
                borderRadius: 10,
                padding: "12px 16px",
                color: isFresh ? "var(--lr-text)" : "var(--lr-white)",
            }}
        >
            <div style={{ flex: 1, minWidth: 220 }}>
                <div
                    style={{
                        fontWeight: 650,
                        fontSize: 14,
                        color: isFresh ? "var(--lr-navy)" : "var(--lr-white)",
                    }}
                >
                    {td("Qualify", { source: "en" })} {firstName}
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: isFresh
                            ? "var(--lr-text-muted)"
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
                style={
                    isFresh
                        ? undefined
                        : { background: "var(--lr-white)", color: "var(--lr-navy)" }
                }
                onClick={onPrimary}
            >
                {td(config.primaryCta.label, { source: "en" })}
            </button>
        </div>
    );
}

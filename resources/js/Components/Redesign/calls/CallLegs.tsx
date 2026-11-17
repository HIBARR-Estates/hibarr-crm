import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import type { CallLeg, CallLogRow } from "./types";

/** How one agent's leg of the call ended, from that agent's side. */
function legKey(outcome: string): string {
    switch (outcome) {
        case "ended":
        case "started":
            return "pages.calls.leg_answered";
        case "declined":
            return "pages.calls.leg_passed";
        case "busy":
            return "pages.calls.leg_busy";
        case "voicemail":
            return "pages.calls.leg_voicemail";
        case "failed":
            return "pages.calls.leg_failed";
        default:
            return "pages.calls.leg_missed";
    }
}

type CallLegsRow = Pick<CallLogRow, "direction" | "user_name" | "answered" | "answered_by_user_name" | "legs">;

function legColor(outcome: string): string {
    if (outcome === "ended" || outcome === "started") {
        return T.GREEN;
    }
    if (outcome === "declined") {
        return T.AMBER;
    }
    return T.RED;
}

/**
 * Who a call reached and who took it: "Answered by Ana" (or "Nobody
 * answered") over "Rang 3 · Ben passed · Cem missed · Ana answered". One
 * call that rang a whole ring group reads as one line, not one per agent.
 */
export default function CallLegs({ row, compact = false }: { row: CallLegsRow; compact?: boolean }) {
    const { t } = useTranslation();
    const legs: CallLeg[] = row.legs ?? [];
    const answeredBy = row.answered_by_user_name ?? (row.answered ? row.user_name : null);

    const headline = row.answered
        ? answeredBy
            ? t("pages.calls.answered_by", { user: answeredBy })
            : t("pages.calls.answered")
        : row.direction === "inbound" && legs.length > 0
          ? t("pages.calls.nobody_answered")
          : row.user_name;

    // A single leg says nothing the headline does not already say.
    const showLegs = legs.length > 1 || (!row.answered && legs.length === 1 && row.direction === "inbound");

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
                style={{
                    fontSize: compact ? 12 : 14,
                    fontWeight: compact ? 500 : 400,
                    color: row.answered || !headline ? T.TEXT : T.RED,
                }}
            >
                {headline ?? "—"}
            </span>
            {showLegs && (
                <span style={{ fontSize: 12, color: T.TEXT_MUTED, lineHeight: 1.5 }}>
                    {t("pages.calls.rang_count", { count: String(legs.length) })}
                    {legs.map((leg) => (
                        <span key={leg.user_id} title={leg.at ?? undefined}>
                            {" · "}
                            <span style={{ color: T.TEXT }}>{leg.user_name ?? t("pages.calls.unknown_agent")}</span>{" "}
                            <span style={{ color: legColor(leg.outcome) }}>{t(legKey(leg.outcome))}</span>
                        </span>
                    ))}
                </span>
            )}
        </div>
    );
}

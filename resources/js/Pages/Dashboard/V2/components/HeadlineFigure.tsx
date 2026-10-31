import type { ReactNode } from "react";
import { Badge, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import { figure } from "../format";
import { TileLabel } from "./StatTile";

/**
 * How a figure moved against the previous window.
 *
 *  - relative: "▲ 30%" — counts and money.
 *  - points:   "▲ 4 pts" — a rate, where a relative change of a percentage
 *              reads as nonsense ("win rate up 16%").
 *  - days:     "▼ 7 days" — a duration.
 */
export interface FigureChange {
    kind: "relative" | "points" | "days";
    current: number | null;
    previous: number | null;
    /** Time to close: down is good. */
    lowerIsBetter?: boolean;
}

interface HeadlineFigureProps {
    /** Already translated. */
    label: string;
    hint?: string | null;
    /** Already formatted; null renders an em dash, never a zero. */
    value: string | null;
    change?: FigureChange;
    /** Replaces the change chip, e.g. a deal count on the pipeline. */
    chip?: ReactNode;
    /** Already translated small print. */
    note?: string | null;
    size?: "hero" | "card" | "compact";
}

const VALUE_SIZE = { hero: 52, card: 30, compact: 20 } as const;

/**
 * One number, how it moved, and one line of context — the company view's only
 * building block, at three sizes, so the hero, the cards and the strip read as
 * one family rather than three kinds of tile.
 */
export default function HeadlineFigure({
    label,
    hint,
    value,
    change,
    chip,
    note,
    size = "card",
}: HeadlineFigureProps) {
    const compact = size === "compact";

    return (
        <div>
            <TileLabel label={label} hint={hint} localize={false} />
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    gap: compact ? 8 : 12,
                    marginTop: compact ? 4 : 8,
                }}
            >
                <span
                    style={{
                        fontSize: VALUE_SIZE[size],
                        fontWeight: 700,
                        lineHeight: 1.05,
                        letterSpacing: size === "hero" ? "-0.02em" : "-0.01em",
                        color: value === null ? T.TEXT_HINT : T.NAVY,
                    }}
                >
                    {value ?? "—"}
                </span>
                {chip ?? (change ? <ChangeChip change={change} plain={compact} /> : null)}
            </div>
            {note && (
                <div
                    style={{
                        marginTop: compact ? 3 : 6,
                        fontSize: size === "hero" ? 13 : 12,
                        color: T.TEXT_HINT,
                    }}
                >
                    {note}
                </div>
            )}
        </div>
    );
}

/**
 * The delta, as a Badge on the larger sizes and as coloured text in the
 * compact strip, where a row of pills would be louder than the numbers.
 */
function ChangeChip({ change, plain }: { change: FigureChange; plain: boolean }) {
    const { t } = useTranslation();
    const { kind, current, previous, lowerIsBetter = false } = change;

    if (current === null || previous === null) {
        return null;
    }

    const delta = current - previous;
    let size: number;
    let text: string;

    if (kind === "relative") {
        if (previous === 0) {
            return null;
        }
        size = Math.round((Math.abs(delta) / Math.abs(previous)) * 100);
        text = `${figure(size)}%`;
    } else if (kind === "points") {
        size = Math.round(Math.abs(delta));
        text = t("pages.dashboard.company.points", { points: figure(size) });
    } else {
        size = Math.round(Math.abs(delta));
        text = t("pages.dashboard.company.days_value", { days: figure(size) });
    }

    if (size === 0) {
        return plain ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: T.TEXT_MUTED }}>
                {t("pages.dashboard.company.flat")}
            </span>
        ) : (
            <Badge variant="gray">{t("pages.dashboard.company.flat")}</Badge>
        );
    }

    const good = lowerIsBetter ? delta < 0 : delta > 0;
    const arrow = delta > 0 ? "▲" : "▼";

    return plain ? (
        <span
            style={{
                fontSize: 13,
                fontWeight: 600,
                color: good ? T.GREEN : T.RED,
            }}
        >
            {arrow} {text}
        </span>
    ) : (
        <Badge variant={good ? "green" : "red"} style={{ padding: "2px 9px" }}>
            {arrow} {text}
        </Badge>
    );
}

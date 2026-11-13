import useTranslation from "@/Hooks/useTranslation";
import { formatMoney } from "../deals/format";
import { criterionAmount, criterionLabel, dayMonth } from "./format";
import type { LevelCard as LevelCardData } from "./types";

/** The wording key for each operator the criteria accept besides ">=". */
const OPERATOR_KEYS: Record<string, "gt" | "lte" | "lt" | "eq"> = { ">": "gt", "<=": "lte", "<": "lt", "=": "eq" };

interface LevelCardProps {
    card: LevelCardData;
    currencySymbol: string;
}

/**
 * The level card beside the latest commissions (L7-21): the level and cycle,
 * how far each criterion of the next level is met, the days left, and what to
 * reach. All of it is the level and cycle data the classic dashboard shows.
 */
export default function LevelCard({ card, currencySymbol }: LevelCardProps) {
    const { t, locale } = useTranslation();
    const money = (value: number) => formatMoney(value, currencySymbol, locale);
    const year = new Date().getFullYear();
    const unmet = card.criteria.filter((criterion) => !criterion.met);
    const endDate = card.cycle?.end_date ? dayMonth(card.cycle.end_date, locale, year) : null;
    const days = card.enrollment?.days_remaining ?? null;

    const cycleName = card.cycle?.name || (card.cycle?.number ? `#${card.cycle.number}` : null);
    const status = card.enrollment ? t(`pages.agent_workspace.earnings.level.status.${card.enrollment.status}`) : null;

    let hint: string;
    if (!card.enrollment) hint = t("pages.agent_workspace.earnings.level.hint_none");
    else if (!card.next_level) hint = t("pages.agent_workspace.earnings.level.hint_top");
    else if (unmet.length === 0) hint = t("pages.agent_workspace.earnings.level.hint_met", { level: card.next_level });
    else {
        const needs = unmet
            .map((criterion) => {
                const amount = `${criterionAmount(criterion.metric, criterion.target, money, locale)} ${criterionLabel(criterion.metric, t).toLowerCase()}`;
                // ">=" reads as before; the other operators say what the number must be, so the hint matches the check.
                const words = OPERATOR_KEYS[criterion.operator];
                return words ? `${t(`pages.agent_workspace.earnings.level.operator.${words}`)} ${amount}` : amount;
            })
            .join(` ${t("pages.agent_workspace.earnings.level.and")} `);
        hint = endDate
            ? t("pages.agent_workspace.earnings.level.hint_next", { needs, date: endDate, level: card.next_level })
            : t("pages.agent_workspace.earnings.level.hint_next_open", { needs, level: card.next_level });
    }

    return (
        <aside className="agent-ea__level" aria-label={t("pages.agent_workspace.earnings.level.label")}>
            <div className="agent-ea__level-head">
                <b>{card.level ? t("pages.agent_workspace.earnings.level.title", { level: card.level }) : t("pages.agent_workspace.earnings.level.title_none")}</b>
                {cycleName && status ? (
                    <span className="agent-ea__level-chip">{t("pages.agent_workspace.earnings.level.cycle", { name: cycleName, status })}</span>
                ) : null}
            </div>

            {card.criteria.map((criterion, index) => (
                <div key={`${criterion.metric}-${index}`} className="agent-ea__bar">
                    <span className="agent-ea__bar-line">
                        <span>{criterionLabel(criterion.metric, t)}</span>
                        <b>
                            {t("pages.agent_workspace.earnings.level.of", {
                                current: criterionAmount(criterion.metric, criterion.current, money, locale),
                                target: criterionAmount(criterion.metric, criterion.target, money, locale),
                            })}
                        </b>
                    </span>
                    <span className="agent-ea__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(criterion.percent)} aria-label={criterionLabel(criterion.metric, t)}>
                        <i style={{ width: `${criterion.percent}%` }} />
                    </span>
                </div>
            ))}

            {days !== null ? (
                <div className="agent-ea__days">
                    <span>{t("pages.agent_workspace.earnings.level.days_left")}</span>
                    <b>{days}</b>
                </div>
            ) : null}
            <p className="agent-ea__hint">{hint}</p>
        </aside>
    );
}

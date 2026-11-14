import { memo } from "react";
import { Link } from "@inertiajs/react";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import { avatarFill } from "../people/format";
import ConditionBars from "./ConditionBars";
import { dealHref } from "./DealLink";
import { IDLE_DAYS, dealLine, formatMoney, meetingView } from "./format";
import type { DealView } from "./types";

interface DealCardProps {
    view: DealView;
    currencySymbol: string;
    nowMs: number;
    timeZone: string;
}

/**
 * A deal on the board (L7-15): the person, the deal under their name, its
 * value and how many of the next stage's conditions it meets, and the
 * chips that need a look (idle, a meeting coming up, ready to move). The
 * person's name is the link; it is stretched over the card so the whole card
 * opens the deal.
 */
function DealCard({ view, currencySymbol, nowMs, timeZone }: DealCardProps) {
    const { t, locale } = useTranslation();
    const { deal } = view;

    const person = deal.person?.trim() || t("pages.agent_workspace.deals.unnamed");
    const meeting = meetingView(deal.next_meeting_at, nowMs, timeZone, locale, t);
    const idle = view.idleDays !== null && view.idleDays >= IDLE_DAYS;

    return (
        <article className="agent-dp__card">
            <span className="agent-dp__card-person">
                <span className="agent-dp__avatar agent-dp__avatar--sm" style={{ ["--fill" as string]: avatarFill(deal.lead_id ?? deal.id) }} aria-hidden="true">
                    {initialsFromName(person)}
                </span>
                <Link
                    href={dealHref(deal)}
                    prefetch={["hover", "click"]}
                    cacheFor="30s"
                    className="agent-dp__name"
                    aria-label={t("pages.agent_workspace.deals.open", { name: person })}
                >
                    {person}
                </Link>
                {deal.locked ? (
                    <span className="agent-dp__lock" role="img" aria-label={t("pages.agent_workspace.deals.locked")} title={t("pages.agent_workspace.deals.locked")}>
                        🔒
                    </span>
                ) : null}
            </span>
            <span className="agent-dp__sub">{dealLine(deal.person, deal.name)}</span>
            <span className="agent-dp__card-figures">
                <span className="agent-dp__value">{formatMoney(deal.value, deal.currency || currencySymbol, locale)}</span>
                <ConditionBars conditions={view.extras?.conditions} />
            </span>
            {meeting || idle || view.ready ? (
                <span className="agent-dp__chips">
                    {idle ? (
                        <span className="agent-dp__pill agent-ts--late">
                            <span className="agent-dp__pill-dot" aria-hidden="true" />
                            {t("pages.agent_workspace.deals.idle", { count: view.idleDays ?? 0 })}
                        </span>
                    ) : null}
                    {meeting ? (
                        <span className={`agent-dp__pill agent-ts--${meeting.state}`}>
                            <span className="agent-dp__pill-dot" aria-hidden="true" />
                            {t("pages.agent_workspace.deals.meeting.chip", { when: meeting.text })}
                        </span>
                    ) : null}
                    {view.ready ? (
                        <span className="agent-dp__pill agent-ts--now">
                            <span className="agent-dp__pill-dot" aria-hidden="true" />
                            {t("pages.agent_workspace.deals.ready")}
                        </span>
                    ) : null}
                </span>
            ) : null}
        </article>
    );
}

export default memo(DealCard);

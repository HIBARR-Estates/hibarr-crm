import { memo } from "react";
import { Link } from "@inertiajs/react";
import Icon from "@/Components/Redesign/primitives/Icon";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { avatarFill } from "../people/format";
import ConditionBars from "./ConditionBars";
import { dealHref } from "./DealLink";
import { activityText, dealLine, formatMoney, meetingView } from "./format";
import type { DealStage, DealView } from "./types";

interface DealRowProps {
    view: DealView;
    stage: DealStage | undefined;
    userId: number;
    currencySymbol: string;
    nowMs: number;
    timeZone: string;
}

/**
 * A deal in the list (L7-16): person and deal, stage, conditions met, next
 * meeting, value, who has it and when anything last happened. The name is
 * the link, stretched over the row.
 */
function DealRow({ view, stage, userId, currencySymbol, nowMs, timeZone }: DealRowProps) {
    const { t, locale } = useTranslation();
    const { td } = useTd();
    const { deal } = view;

    const person = deal.person?.trim() || t("pages.agent_workspace.deals.unnamed");
    const meeting = meetingView(deal.next_meeting_at, nowMs, timeZone, locale, t);
    const activity = view.extras || deal.created_at ? activityText(view, nowMs, timeZone, locale, t) : null;
    const mine = deal.agent_id === userId;
    const createdByViewer = deal.added_by === userId;

    return (
        <div role="row" className="agent-dp__row">
            <div role="cell" className="agent-dp__person agent-dp__c--person">
                <span className="agent-dp__avatar" style={{ ["--fill" as string]: avatarFill(deal.lead_id ?? deal.id) }} aria-hidden="true">
                    {initialsFromName(person)}
                </span>
                <span className="agent-dp__who">
                    <Link
                        href={dealHref(deal)}
                        prefetch={["hover", "click"]}
                        cacheFor="30s"
                        className="agent-dp__name agent-dp__name--row"
                        aria-label={t("pages.agent_workspace.deals.open", { name: person })}
                    >
                        {person}
                    </Link>
                    <span className="agent-dp__sub">
                        {dealLine(deal.person, deal.name)}
                        {deal.locked ? ` · 🔒 ${t("pages.agent_workspace.deals.commission_locked")}` : ""}
                    </span>
                </span>
            </div>

            <div className="agent-dp__line">
                <div role="cell" className="agent-dp__stage agent-dp__c--stage">
                    <span className="agent-dp__stage-mark" style={{ ["--stage" as string]: stage?.color || undefined }} aria-hidden="true" />
                    <span>{stage ? td(stage.name, { source: "en" }) : ""}</span>
                </div>

                <div role="cell" className="agent-dp__c--conditions">
                    <ConditionBars conditions={view.extras?.conditions} />
                </div>

                <div role="cell" className="agent-dp__c--meeting">
                    {meeting ? (
                        <span className={`agent-dp__pill agent-ts--${meeting.state}`}>
                            <span className="agent-dp__pill-dot" aria-hidden="true" />
                            {meeting.text}
                        </span>
                    ) : (
                        <span className="agent-dp__muted">{t("pages.agent_workspace.deals.no_value")}</span>
                    )}
                </div>

                <div role="cell" className="agent-dp__value agent-dp__c--value">
                    {formatMoney(deal.value, deal.currency || currencySymbol, locale)}
                </div>

                <div role="cell" className="agent-dp__c--agent">
                    {deal.agent_name ? (
                        <span className="agent-dp__agent">
                            <span className={`agent-dp__agent-avatar${mine ? "" : " agent-dp__agent-avatar--other"}`} aria-hidden="true">
                                {initialsFromName(deal.agent_name)}
                            </span>
                            <span className="agent-dp__agent-text">
                                {mine ? t("pages.agent_workspace.deals.you") : deal.agent_name}
                                {!mine && createdByViewer ? <small>{t("pages.agent_workspace.deals.you_created")}</small> : null}
                            </span>
                        </span>
                    ) : (
                        <span className="agent-dp__muted">{t("pages.agent_workspace.deals.unassigned")}</span>
                    )}
                </div>

                <div role="cell" className="agent-dp__c--activity">
                    {activity ? (
                        <span className={activity.idle ? "agent-dp__idle" : "agent-dp__muted"}>{activity.text}</span>
                    ) : (
                        <span className="agent-dp__loading" aria-hidden="true" />
                    )}
                </div>
            </div>

            <span className="agent-dp__chevron" aria-hidden="true">
                <Icon name="chevron-right" size={16} />
            </span>
        </div>
    );
}

export default memo(DealRow);

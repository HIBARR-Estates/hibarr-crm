import { memo } from "react";
import { Link } from "@inertiajs/react";
import Icon from "@/Components/Redesign/primitives/Icon";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { formatMobileForDisplay } from "@/lib/utils";
import type { ActivityKind } from "../today/AddActivityMenu";
import NextActionCell from "./NextActionCell";
import { avatarFill, lastTouchText, nextActionDue } from "./format";
import type { Lead, LifecycleStatus, RowExtras } from "./types";

interface PersonRowProps {
    lead: Lead;
    status: LifecycleStatus | undefined;
    /** Undefined while the deferred deals and last touch are on their way. */
    extras: RowExtras | undefined;
    userId: number;
    nowMs: number;
    timeZone: string;
    onOpenAction: (lead: Lead, action: NonNullable<Lead["next_action"]>) => void;
    onAddAction: (lead: Lead, kind: ActivityKind) => void;
}

/** Phone number, then city: what an agent needs to place the person at a glance. */
function contactLine(lead: Lead): string {
    const phone = formatMobileForDisplay(lead.mobile) || formatMobileForDisplay(lead.cell) || formatMobileForDisplay(lead.office);
    return [phone, lead.city].filter(Boolean).join(" · ");
}

/**
 * One person in the list (L7-14): who they are, where they stand, what is
 * next and when, their open deals, who owns them and when they were last
 * touched. The name is the link; its hit area is stretched over the row
 * (agent-pp__name::after), so the whole row opens the person's page and a
 * keyboard stops once per person.
 */
function PersonRow({ lead, status, extras, userId, nowMs, timeZone, onOpenAction, onAddAction }: PersonRowProps) {
    const { t, locale } = useTranslation();
    const { td } = useTd();

    const name = lead.client_name?.trim() || t("pages.agent_workspace.people.row.unnamed");
    const href = route("agent.people.show", lead.id);
    const action = lead.next_action ?? null;
    const due = nextActionDue(action?.due_at, nowMs, timeZone, locale, t);
    const owner = lead.lead_owner ?? null;
    const ownedByViewer = owner?.id === userId;
    const addedByViewer = lead.added_by?.id === userId;
    const contact = contactLine(lead);

    return (
        <div role="row" className="agent-pp__row">
            <div role="cell" className="agent-pp__person agent-pp__c--person">
                <span className="agent-pp__avatar" style={{ ["--fill" as string]: avatarFill(lead.id) }} aria-hidden="true">
                    {initialsFromName(name)}
                </span>
                <span className="agent-pp__who">
                    <Link
                        href={href}
                        prefetch={["hover", "click"]}
                        cacheFor="30s"
                        className="agent-pp__name"
                        aria-label={t("pages.agent_workspace.people.row.open", { name })}
                    >
                        {name}
                    </Link>
                    {contact ? <span className="agent-pp__sub">{contact}</span> : null}
                </span>
            </div>

            <div className="agent-pp__line">
                <div role="cell" className="agent-pp__c--status">
                    {status ? (
                        <span className="agent-pp__status" style={{ ["--tag" as string]: status.label_color || undefined }}>
                            {td(status.label, { source: "en" })}
                        </span>
                    ) : (
                        <span className="agent-pp__muted">{t("pages.agent_workspace.people.row.no_value")}</span>
                    )}
                </div>

                <div role="cell" className="agent-pp__c--action">
                    <NextActionCell lead={lead} action={action} onOpen={onOpenAction} onAdd={onAddAction} />
                </div>

                <div role="cell" className="agent-pp__c--due">
                    <span className={`agent-pp__due agent-ts--${due.state}`}>
                        <span className="agent-pp__due-dot" aria-hidden="true" />
                        {due.text}
                    </span>
                </div>

                <div role="cell" className="agent-pp__deals agent-pp__c--deals">
                    {extras === undefined ? (
                        <span className="agent-pp__cell-loading" aria-hidden="true" />
                    ) : extras.deals.length === 0 ? (
                        <span className="agent-pp__muted">{t("pages.agent_workspace.people.row.no_value")}</span>
                    ) : (
                        extras.deals.map((deal) => (
                            <span key={deal.id} className="agent-pp__deal">
                                <span
                                    className="agent-pp__deal-mark"
                                    style={{ ["--mark" as string]: deal.stage_color || undefined }}
                                    aria-hidden="true"
                                />
                                <span>{deal.stage ? td(deal.stage, { source: "en" }) : (deal.name ?? "")}</span>
                            </span>
                        ))
                    )}
                </div>

                <div role="cell" className={`agent-pp__c--owner${ownedByViewer ? " agent-pp__c--you" : ""}`}>
                    {owner ? (
                        <span className="agent-pp__owner">
                            <span className={`agent-pp__owner-avatar${ownedByViewer ? "" : " agent-pp__owner-avatar--other"}`} aria-hidden="true">
                                {initialsFromName(owner.name)}
                            </span>
                            <span className="agent-pp__owner-text">
                                {ownedByViewer ? t("pages.agent_workspace.people.row.you") : owner.name}
                                {!ownedByViewer && addedByViewer ? <small>{t("pages.agent_workspace.people.row.added_by_you")}</small> : null}
                            </span>
                        </span>
                    ) : (
                        <span className="agent-pp__muted">{t("pages.agent_workspace.people.row.unassigned")}</span>
                    )}
                </div>

                <div role="cell" className="agent-pp__c--touch">
                    {extras === undefined ? (
                        <span className="agent-pp__cell-loading" aria-hidden="true" />
                    ) : (
                        <span className="agent-pp__muted">{lastTouchText(extras.last_touch_at, nowMs, timeZone, locale, t)}</span>
                    )}
                </div>
            </div>

            <span className="agent-pp__chevron" aria-hidden="true">
                <Icon name="chevron-right" size={16} />
            </span>
        </div>
    );
}

export default memo(PersonRow);

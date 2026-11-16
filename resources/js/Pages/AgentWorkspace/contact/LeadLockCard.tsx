import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadRestriction } from "./RestrictedDealHeader";

/**
 * Says why the lead's own details are not on this page and who to ask (canvas
 * L7-30). Dashed, like every other "nothing here for you" card.
 */
export default function LeadLockCard({ name, restriction }: { name: string; restriction: LeadRestriction }) {
    const { t } = useTranslation();
    const owner = restriction.owner_name;
    const title = owner
        ? t("pages.agent_workspace.deal.restricted.lock_title", { owner })
        : t("pages.agent_workspace.deal.restricted.lock_title_no_owner");

    return (
        <section className="agent-restricted__lock" aria-label={title}>
            <span className="agent-restricted__lock-icon" aria-hidden="true">
                <Icon name="lock" size={16} />
            </span>
            <div>
                <h2>{title}</h2>
                <p>
                    {owner
                        ? t("pages.agent_workspace.deal.restricted.lock_text", { name, owner })
                        : t("pages.agent_workspace.deal.restricted.lock_text_no_owner", { name })}
                </p>
            </div>
        </section>
    );
}

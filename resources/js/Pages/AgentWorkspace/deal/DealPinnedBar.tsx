import { AgentPinned } from "@/Components/Redesign/agent";
import AgentCallButton from "@/Components/Redesign/agent/AgentCallButton";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import { NewActivityButton } from "../contact/ContactHeader";

export interface SectionPill {
    id: string;
    label: string;
}

interface DealPinnedBarProps {
    /** The compact bar and the pills show only once the page's own header has scrolled away. */
    visible: boolean;
    name: string;
    initials: string;
    stageName: string;
    conditions: { met: number; total: number } | null;
    phone: string;
    callEntityId: number;
    allowedCreate: Partial<Record<LeadCreateKind, boolean>>;
    onCreate: (kind: LeadCreateKind) => void;
    onEdit?: () => void;
    pills: SectionPill[];
    active: string | null;
    onJump: (id: string) => void;
}

/**
 * The page's header, shrunk and pinned under the dock while the sections
 * scroll (canvas L7-11): who, which stage, how many conditions are met, the
 * three actions, then one pill per section to jump to.
 */
export default function DealPinnedBar({
    visible,
    name,
    initials,
    stageName,
    conditions,
    phone,
    callEntityId,
    allowedCreate,
    onCreate,
    onEdit,
    pills,
    active,
    onJump,
}: DealPinnedBarProps) {
    const { t } = useTranslation();

    return (
        <AgentPinned>
            {visible ? (
                <div className="agent-deal__pin">
                    <div className="agent-deal__bar">
                        <span className="agent-deal__bar-avatar" aria-hidden="true">
                            {initials}
                        </span>
                        <span className="agent-deal__bar-name">{name}</span>
                        <span className="agent-deal__bar-chip">
                            <span className="agent-deal__bar-square" aria-hidden="true" />
                            {t("pages.agent_workspace.contact.deal_pill", { stage: stageName })}
                        </span>
                        {conditions && conditions.total > 0 ? (
                            <span className="agent-deal__bar-count">
                                {t("pages.agent_workspace.deal.bar.conditions", { met: conditions.met, total: conditions.total })}
                            </span>
                        ) : null}
                        <span className="agent-deal__bar-actions">
                            <AgentCallButton phone={phone} entity={{ type: "deal", id: callEntityId }} />
                            <NewActivityButton onCreate={onCreate} allowed={allowedCreate} size="sm" />
                            {onEdit ? (
                                <Button size="sm" variant="ghost" onClick={onEdit}>
                                    <Icon name="edit" size={13} />
                                    {t("pages.agent_workspace.contact.edit_details")}
                                </Button>
                            ) : null}
                        </span>
                    </div>
                    <nav className="agent-deal__pills" aria-label={t("pages.agent_workspace.deal.pills.aria")}>
                        {pills.map((pill) => (
                            <button
                                key={pill.id}
                                type="button"
                                className="agent-pills__pill"
                                aria-current={pill.id === active ? "true" : undefined}
                                onClick={() => onJump(pill.id)}
                            >
                                {pill.label}
                            </button>
                        ))}
                    </nav>
                </div>
            ) : null}
        </AgentPinned>
    );
}

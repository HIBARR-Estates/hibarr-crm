import { ReactNode, useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import DealAvatar from "../primitives/DealAvatar";
import DealAgentPicker from "../primitives/DealAgentPicker";
import DealBadge from "../primitives/DealBadge";
import DealButton from "../primitives/DealButton";
import DealPanelHeader from "../primitives/DealPanelHeader";
import DealPeoplePicker, {
    type DealPersonOption,
} from "../primitives/DealPeoplePicker";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import useDealTeamMutations from "../../hooks/useDealTeamMutations";

export interface TeamMember {
    id: number;
    name: string;
    initials: string;
    meta?: string;
}

interface DealTeamModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
    agent: TeamMember | null;
    participants: TeamMember[];
    watchers: TeamMember[];
    employees: Array<{
        id: number;
        name: string;
        email?: string;
        designation_name?: string;
    }>;
    canEdit?: boolean;
    canEditAgent?: boolean;
}

type AddingRole = "agent" | "participants" | "watchers" | null;

interface TeamMemberRowProps {
    member: TeamMember;
    type: "agent" | "participant" | "watcher";
    onRemove?: () => void;
    removing?: boolean;
}

/** v2.2 TeamRow (deal-v2-2.jsx:1019-1032). */
function TeamMemberRow({ member, type, onRemove, removing }: TeamMemberRowProps) {
    const { t } = useTranslation();
    return (
        <div
            className="flex items-center justify-between gap-2.5 px-3 py-2.5 last:border-b-0"
            style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
        >
            <div className="flex min-w-0 items-center gap-2.5">
                <DealAvatar type={type} size={32} initials={member.initials} />
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#1a1f2e]">
                        {member.name}
                    </div>
                    {member.meta && (
                        <div className="mt-0.5 truncate text-[12px] text-[#5b6472]">
                            {member.meta}
                        </div>
                    )}
                </div>
            </div>
            {onRemove && (
                <DealButton
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                    disabled={removing}
                    loading={removing}
                >
                    {t("pages.deals.common.remove")}
                </DealButton>
            )}
        </div>
    );
}

interface TeamSectionProps {
    title: string;
    tag: string;
    tagVariant: "blue" | "green" | "gray";
    children: ReactNode;
    action?: ReactNode;
}

/** v2.2 TeamSection (deal-v2-2.jsx:1034-1047). */
function TeamSection({ title, tag, tagVariant, action, children }: TeamSectionProps) {
    return (
        <div className="mb-[18px]">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1f2e]">
                    {title}
                    <DealBadge variant={tagVariant}>{tag}</DealBadge>
                </div>
                {action}
            </div>
            <div className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                {children}
            </div>
        </div>
    );
}

/** v2.2's shared picker wrapper (deal-v2-2.jsx:1056-1060) — same slot inside
 * every section's bordered box, right below the rows/empty state. */
function PickerSlot({ children }: { children: ReactNode }) {
    return (
        <div
            className="px-3 py-2.5"
            style={{
                borderTop: `1px solid ${T.BORDER_SOFT}`,
                background: T.SURFACE_2,
            }}
        >
            {children}
        </div>
    );
}

/** Ported from v2.2's TeamModal (deal-v2-2.jsx:1049-1131). */
export default function DealTeamModal({
    open,
    onClose,
    dealId,
    agent,
    participants,
    watchers,
    employees,
    canEdit = true,
    canEditAgent,
}: DealTeamModalProps) {
    const agentEditable = canEditAgent ?? canEdit;
    const { t } = useTranslation();
    const { saveTeamField, isSaving } = useDealTeamMutations(dealId);
    const [adding, setAdding] = useState<AddingRole>(null);
    // Tracks which specific picker row is being assigned, so the picker can
    // show a spinner on that row rather than leaving the click unacknowledged.
    const [pendingPickId, setPendingPickId] = useState<number | null>(null);
    // Tracks which specific member is being removed. isSaving("deal_participant")
    // is keyed by field, not by row — it's true for the whole list while any
    // one member's removal is in flight, which spun every row's Remove button
    // at once instead of just the one that was clicked.
    const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);

    const toggleAdding = (role: AddingRole) =>
        setAdding((current) => (current === role ? null : role));

    // v2.2 excludes everyone already holding any role from every picker
    // (deal-v2-2.jsx:1055) — one person, one role.
    const taken = useMemo(
        () => [
            ...(agent ? [agent.id] : []),
            ...participants.map((member) => member.id),
            ...watchers.map((member) => member.id),
        ],
        [agent, participants, watchers],
    );

    const employeeOptions: DealPersonOption[] = useMemo(
        () =>
            employees.map((employee) => ({
                id: employee.id,
                name: employee.name,
                designation: employee.designation_name,
            })),
        [employees],
    );

    const handleAgentPick = (agentId: number) => {
        if (!agentEditable) return;
        setPendingPickId(agentId);
        saveTeamField("agent_id", agentId)
            .then(() => setAdding(null))
            .finally(() => setPendingPickId(null));
    };

    const handleUnassignAgent = () => {
        if (!agentEditable || !agent) return;
        setPendingRemoveId(agent.id);
        saveTeamField("agent_id", null).finally(() => setPendingRemoveId(null));
    };

    const handleAddParticipant = (employeeId: number) => {
        if (!canEdit) return;
        setPendingPickId(employeeId);
        const nextIds = [...participants.map((item) => item.id), employeeId];
        saveTeamField("deal_participant", nextIds)
            .then(() => setAdding(null))
            .finally(() => setPendingPickId(null));
    };

    const handleRemoveParticipant = (memberId: number) => {
        if (!canEdit) return;
        setPendingRemoveId(memberId);
        const nextIds = participants
            .filter((item) => item.id !== memberId)
            .map((item) => item.id);
        saveTeamField("deal_participant", nextIds).finally(() =>
            setPendingRemoveId(null),
        );
    };

    const handleAddWatcher = (employeeId: number) => {
        if (!canEdit) return;
        setPendingPickId(employeeId);
        const nextIds = [...watchers.map((item) => item.id), employeeId];
        saveTeamField("deal_watcher", nextIds)
            .then(() => setAdding(null))
            .finally(() => setPendingPickId(null));
    };

    const handleRemoveWatcher = (memberId: number) => {
        if (!canEdit) return;
        setPendingRemoveId(memberId);
        const nextIds = watchers
            .filter((item) => item.id !== memberId)
            .map((item) => item.id);
        saveTeamField("deal_watcher", nextIds).finally(() =>
            setPendingRemoveId(null),
        );
    };

    if (!open) return null;

    return (
        <div className="modal-overlay redesign-modal-overlay" onClick={onClose}>
            <div
                className="modal-panel"
                onClick={(event) => event.stopPropagation()}
                style={{ maxWidth: 520 }}
            >
                <DealPanelHeader
                    title={t("pages.deals.header.team.modal_title")}
                    onClose={onClose}
                />
                <div className="px-[18px] py-4">
                    <TeamSection
                        title={t("pages.deals.info.fields.deal_agent")}
                        tag={`${t("pages.deals.header.team.owner_tag")} · ${t(
                            "pages.deals.header.team.can_edit_tag",
                        )}`}
                        tagVariant="blue"
                        action={
                            agentEditable && agent ? (
                                <DealButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleAdding("agent")}
                                    disabled={isSaving("agent_id")}
                                >
                                    {adding === "agent"
                                        ? t("pages.deals.common.cancel")
                                        : t("pages.deals.header.team.change")}
                                </DealButton>
                            ) : undefined
                        }
                    >
                        {agent ? (
                            <TeamMemberRow
                                member={{
                                    ...agent,
                                    meta: agent.meta ?? t("pages.deals.header.team.primary_owner"),
                                }}
                                type="agent"
                                onRemove={
                                    agentEditable ? handleUnassignAgent : undefined
                                }
                                removing={pendingRemoveId === agent.id}
                            />
                        ) : (
                            <div className="px-3.5 py-3.5 text-center">
                                <p className="mb-2.5 text-xs text-[#5b6472]">
                                    {t("pages.deals.header.team.no_agent_hint")}
                                </p>
                                {agentEditable && (
                                    <DealButton
                                        variant="primary"
                                        size="sm"
                                        onClick={() => toggleAdding("agent")}
                                    >
                                        {adding === "agent"
                                            ? t("pages.deals.common.cancel")
                                            : t("pages.deals.header.team.assign_agent")}
                                    </DealButton>
                                )}
                            </div>
                        )}
                        {agentEditable && adding === "agent" && (
                            <PickerSlot>
                                <DealAgentPicker
                                    exclude={taken}
                                    autoFocus
                                    pendingId={pendingPickId}
                                    onPick={(picked) => handleAgentPick(picked.id)}
                                />
                            </PickerSlot>
                        )}
                    </TeamSection>

                    <TeamSection
                        title={t("pages.deals.header.team.participants_title")}
                        tag={t("pages.deals.header.team.can_edit_tag")}
                        tagVariant="green"
                        action={
                            canEdit ? (
                                <DealButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleAdding("participants")}
                                >
                                    {adding === "participants"
                                        ? t("pages.deals.common.cancel")
                                        : `+ ${t("pages.deals.common.add")}`}
                                </DealButton>
                            ) : undefined
                        }
                    >
                        {participants.length === 0 && (
                            <div className="px-3.5 py-3 text-xs italic text-[#5b6472]">
                                {t("pages.deals.header.team.no_participants_hint")}
                            </div>
                        )}
                        {participants.map((member) => (
                            <TeamMemberRow
                                key={member.id}
                                member={member}
                                type="participant"
                                onRemove={
                                    canEdit
                                        ? () => handleRemoveParticipant(member.id)
                                        : undefined
                                }
                                removing={pendingRemoveId === member.id}
                            />
                        ))}
                        {canEdit && adding === "participants" && (
                            <PickerSlot>
                                <DealPeoplePicker
                                    people={employeeOptions}
                                    exclude={taken}
                                    autoFocus
                                    pendingId={pendingPickId}
                                    onPick={(picked) =>
                                        handleAddParticipant(picked.id)
                                    }
                                />
                            </PickerSlot>
                        )}
                    </TeamSection>

                    <TeamSection
                        title={t("pages.deals.header.watchers_label")}
                        tag={t("pages.deals.header.team.view_only_tag")}
                        tagVariant="gray"
                        action={
                            canEdit ? (
                                <DealButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleAdding("watchers")}
                                >
                                    {adding === "watchers"
                                        ? t("pages.deals.common.cancel")
                                        : `+ ${t("pages.deals.common.add")}`}
                                </DealButton>
                            ) : undefined
                        }
                    >
                        {watchers.length === 0 && (
                            <div className="px-3.5 py-3 text-xs italic text-[#5b6472]">
                                {t("pages.deals.header.team.no_watchers_hint")}
                            </div>
                        )}
                        {watchers.map((member) => (
                            <TeamMemberRow
                                key={member.id}
                                member={member}
                                type="watcher"
                                onRemove={
                                    canEdit
                                        ? () => handleRemoveWatcher(member.id)
                                        : undefined
                                }
                                removing={pendingRemoveId === member.id}
                            />
                        ))}
                        {canEdit && adding === "watchers" && (
                            <PickerSlot>
                                <DealPeoplePicker
                                    people={employeeOptions}
                                    exclude={taken}
                                    autoFocus
                                    pendingId={pendingPickId}
                                    onPick={(picked) => handleAddWatcher(picked.id)}
                                />
                            </PickerSlot>
                        )}
                    </TeamSection>
                </div>
            </div>
        </div>
    );
}

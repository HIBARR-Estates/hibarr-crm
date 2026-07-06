import { CSSProperties, ReactNode, useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import AgentSelector from "@/Components/AgentSelector";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealPanelHeader from "../primitives/DealPanelHeader";
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
    employees: Array<{ id: number; name: string; email?: string }>;
    canEdit?: boolean;
}

interface TeamMemberRowProps {
    member: TeamMember;
    type: "agent" | "participant" | "watcher";
    onRemove?: () => void;
    removing?: boolean;
}

function TeamMemberRow({ member, type, onRemove, removing }: TeamMemberRowProps) {
    return (
        <div
            className="flex items-center justify-between border-b border-[#e2e5ea] px-3.5 py-2.5 last:border-b-0"
        >
            <div className="flex min-w-0 items-center gap-2.5">
                <DealAvatar type={type} size={32} initials={member.initials} />
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[#1a1f2e]">
                        {member.name}
                    </div>
                    {member.meta && (
                        <div className="mt-0.5 truncate text-[11px] text-[#9ca3af]">
                            {member.meta}
                        </div>
                    )}
                </div>
            </div>
            {onRemove && (
                <DealButton variant="ghost" onClick={onRemove} disabled={removing}>
                    Remove
                </DealButton>
            )}
        </div>
    );
}

interface TeamRoleBlockProps {
    title: string;
    dotColor: string;
    tag: string;
    tagStyle: CSSProperties;
    children: ReactNode;
    onAdd?: () => void;
    addLabel?: string;
    headerAction?: ReactNode;
}

function TeamRoleBlock({
    title,
    dotColor,
    tag,
    tagStyle,
    children,
    onAdd,
    addLabel = "+ Add",
    headerAction,
}: TeamRoleBlockProps) {
    return (
        <div className="mb-[22px]">
            <div className="mb-2.5 flex items-center justify-between border-b border-[#e2e5ea] pb-2">
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#1a1f2e]">
                    <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: dotColor }}
                    />
                    {title}
                    <span
                        className="rounded-[10px] px-2 py-0.5 text-[11px] font-medium"
                        style={tagStyle}
                    >
                        {tag}
                    </span>
                </div>
                {headerAction}
                {onAdd && !headerAction && (
                    <DealButton variant="ghost" onClick={onAdd}>
                        {addLabel}
                    </DealButton>
                )}
            </div>
            <div className="overflow-hidden rounded-lg border border-[#e2e5ea] bg-white">
                {children}
            </div>
        </div>
    );
}

function AddMemberRow({
    employees,
    onAdd,
    onCancel,
    saving,
}: {
    employees: Array<{ id: number; name: string }>;
    onAdd: (employeeId: number) => void;
    onCancel: () => void;
    saving?: boolean;
}) {
    const [selectedId, setSelectedId] = useState("");

    return (
        <div className="flex items-center gap-2 border-t border-[#e2e5ea] bg-[#f9fafb] px-3.5 py-2.5">
            <select
                className="min-w-0 flex-1 rounded-md border border-[#e2e5ea] px-2 py-1.5 text-xs"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                disabled={saving}
            >
                <option value="">Select team member…</option>
                {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                        {employee.name}
                    </option>
                ))}
            </select>
            <DealButton
                variant="primary"
                disabled={!selectedId || saving}
                onClick={() => {
                    if (!selectedId) return;
                    onAdd(Number(selectedId));
                    setSelectedId("");
                }}
            >
                Add
            </DealButton>
            <DealButton variant="ghost" onClick={onCancel} disabled={saving}>
                Cancel
            </DealButton>
        </div>
    );
}

export default function DealTeamModal({
    open,
    onClose,
    dealId,
    agent,
    participants,
    watchers,
    employees,
    canEdit = true,
}: DealTeamModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { saveTeamField, isSaving } = useDealTeamMutations(dealId);

    const [addingParticipants, setAddingParticipants] = useState(false);
    const [addingWatchers, setAddingWatchers] = useState(false);

    const availableParticipantEmployees = useMemo(
        () =>
            employees.filter(
                (employee) =>
                    !participants.some((participant) => participant.id === employee.id) &&
                    agent?.id !== employee.id,
            ),
        [agent?.id, employees, participants],
    );

    const availableWatcherEmployees = useMemo(
        () =>
            employees.filter(
                (employee) =>
                    !watchers.some((watcher) => watcher.id === employee.id) &&
                    agent?.id !== employee.id &&
                    !participants.some((participant) => participant.id === employee.id),
            ),
        [agent?.id, employees, participants, watchers],
    );

    const handleAgentChange = (agentId: number | null) => {
        if (!canEdit) return;
        saveTeamField("agent_id", agentId);
    };

    const handleAddParticipant = (employeeId: number) => {
        if (!canEdit) return;
        const nextIds = [...participants.map((item) => item.id), employeeId];
        saveTeamField("deal_participant", nextIds).then(() => setAddingParticipants(false));
    };

    const handleRemoveParticipant = (memberId: number) => {
        if (!canEdit) return;
        const nextIds = participants
            .filter((item) => item.id !== memberId)
            .map((item) => item.id);
        saveTeamField("deal_participant", nextIds);
    };

    const handleAddWatcher = (employeeId: number) => {
        if (!canEdit) return;
        const nextIds = [...watchers.map((item) => item.id), employeeId];
        saveTeamField("deal_watcher", nextIds).then(() => setAddingWatchers(false));
    };

    const handleRemoveWatcher = (memberId: number) => {
        if (!canEdit) return;
        const nextIds = watchers
            .filter((item) => item.id !== memberId)
            .map((item) => item.id);
        saveTeamField("deal_watcher", nextIds);
    };

    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-panel"
                onClick={(event) => event.stopPropagation()}
                style={{ maxWidth: 520 }}
            >
                <DealPanelHeader
                    title={td("Deal team")}
                    onClose={onClose}
                />
                <div className="px-[18px] py-4">
                    <p className="mb-4 text-xs text-[#6b7280]">
                        {td("Manage who can view and work this deal")}
                    </p>

                    <TeamRoleBlock
                        title={t("pages.deals.info.fields.deal_agent")}
                        dotColor={T.BLUE}
                        tag={td("Can edit")}
                        tagStyle={{
                            background: T.BLUE_LIGHT,
                            color: T.BLUE,
                            border: `1px solid ${T.BLUE_MID}`,
                        }}
                        headerAction={
                            canEdit ? (
                                <AgentSelector
                                    size="small"
                                    currentAgent={null}
                                    onSelect={handleAgentChange}
                                    placeholder={td("Reassign")}
                                />
                            ) : undefined
                        }
                    >
                        {agent ? (
                            <TeamMemberRow
                                member={{
                                    ...agent,
                                    meta:
                                        agent.meta ??
                                        td("Primary owner"),
                                }}
                                type="agent"
                            />
                        ) : (
                            <div className="px-3.5 py-3 text-[13px] italic text-[#9ca3af]">
                                {td("No agent assigned.")}
                            </div>
                        )}
                    </TeamRoleBlock>

                    <TeamRoleBlock
                        title={t("pages.deals.info.fields.deal_participants")}
                        dotColor={T.GREEN}
                        tag={td("Can edit")}
                        tagStyle={{
                            background: T.GREEN_LIGHT,
                            color: T.GREEN,
                            border: `1px solid ${T.GREEN_MID}`,
                        }}
                        onAdd={
                            canEdit && availableParticipantEmployees.length > 0
                                ? () => setAddingParticipants(true)
                                : undefined
                        }
                    >
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
                                removing={isSaving("deal_participant")}
                            />
                        ))}
                        {participants.length === 0 && !addingParticipants && (
                            <div className="px-3.5 py-3 text-[13px] italic text-[#9ca3af]">
                                {td("No participants added.")}
                            </div>
                        )}
                        {addingParticipants && (
                            <AddMemberRow
                                employees={availableParticipantEmployees}
                                onAdd={handleAddParticipant}
                                onCancel={() => setAddingParticipants(false)}
                                saving={isSaving("deal_participant")}
                            />
                        )}
                    </TeamRoleBlock>

                    <TeamRoleBlock
                        title={t("pages.deals.info.fields.deal_watchers")}
                        dotColor="#9ca3af"
                        tag={td("View only")}
                        tagStyle={{
                            background: T.GRAY,
                            color: T.GRAY_DARKER,
                            border: `1px solid ${T.GRAY_MID}`,
                        }}
                        onAdd={
                            canEdit && availableWatcherEmployees.length > 0
                                ? () => setAddingWatchers(true)
                                : undefined
                        }
                    >
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
                                removing={isSaving("deal_watcher")}
                            />
                        ))}
                        {watchers.length === 0 && !addingWatchers && (
                            <div className="px-3.5 py-3 text-[13px] italic text-[#9ca3af]">
                                {td("No watchers added.")}
                            </div>
                        )}
                        {addingWatchers && (
                            <AddMemberRow
                                employees={availableWatcherEmployees}
                                onAdd={handleAddWatcher}
                                onCancel={() => setAddingWatchers(false)}
                                saving={isSaving("deal_watcher")}
                            />
                        )}
                    </TeamRoleBlock>
                </div>
            </div>
        </div>
    );
}

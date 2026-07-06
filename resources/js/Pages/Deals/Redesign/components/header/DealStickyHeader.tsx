import { router } from "@inertiajs/react";
import { Alert } from "antd";
import { LockOutlined } from "@ant-design/icons";
import axios from "axios";
import { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useDealHeaderData from "../../hooks/useDealHeaderData";
import useDealPipeline from "../../hooks/useDealPipeline";
import useDealTeam from "../../hooks/useDealTeam";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealAvatar from "../primitives/DealAvatar";
import DealBadge from "../primitives/DealBadge";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DealModal, DealModalField } from "../primitives/DealModal";

interface DealStickyHeaderProps {
    deal: Deal;
    permissions: Record<string, string>;
    employees: any[];
    isRefreshing: boolean;
    onRefresh: () => void;
}

function hasAllPermission(permissions: Record<string, string>, key: string) {
    return permissions?.[key] === "all";
}

export default function DealStickyHeader({
    deal,
    permissions,
    employees,
    isRefreshing,
    onRefresh,
}: DealStickyHeaderProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const header = useDealHeaderData(deal);
    const team = useDealTeam(deal);
    const pipeline = useDealPipeline(
        deal,
        hasAllPermission(permissions, "change_deal_stages"),
    );

    const employeeOptions = employees ?? [];

    const saveTeamField = async (
        field: "agent_id" | "deal_participant" | "deal_watcher",
        value: number[],
    ) => {
        await axios.patch(
            route("deals.gathering.inline_update", { id: deal.id }),
            {
                type: "details",
                data: {
                    [field]: field === "agent_id" ? (value[0] ?? null) : value,
                },
            },
        );
        router.reload({ only: ["deal"] });
    };

    return (
        <div className="sticky top-0 z-50 border-b border-[#e2e5ea] bg-white">
            {deal.is_locked && (
                <div className="px-6 pt-4">
                    <Alert
                        message={t("pages.deals.locked_message")}
                        type="warning"
                        showIcon
                        icon={<LockOutlined />}
                        banner
                    />
                </div>
            )}

            {/* <div className="flex items-center justify-between px-[26px] py-[14px] text-xs text-[#6b7280]">
                <div className="flex items-center gap-1.5">
                    <DealIcon name="home" size={12} color={T.TEXT_HINT} />
                    <span>{t("app.menu.dashboard")}</span>
                    <span style={{ color: T.TEXT_HINT }}>.</span>
                    <span>{td("Deals")}</span>
                    <span style={{ color: T.TEXT_HINT }}>.</span>
                    <span className="font-medium text-[#1a1f2e]">{td(deal.name)}</span>
                </div>
                <DealButton
                    variant="ghost"
                    icon={<DealIcon name="refresh" size={12} />}
                    onClick={onRefresh}
                    disabled={isRefreshing}
                >
                    {t("app.common.actions.refresh")}
                </DealButton>
            </div> */}

            <div className="px-[26px] pt-4">
                <div className="mb-[10px] flex items-start justify-between">
                    <div>
                        <div className="text-[18px] font-semibold tracking-[-0.01em] text-[#1a1f2e]">
                            {td(header.title)}
                        </div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-[#9ca3af]">
                            {td(header.pipelineName)}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3.5 text-[11px] text-[#9ca3af]">
                            <span className="inline-flex items-center gap-1">
                                <DealIcon name="calendar" size={11} />
                                {t("pages.deals.info.fields.created_at")}:{" "}
                                {header.createdAt}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <DealIcon name="calendar" size={11} />
                                {t("pages.deals.info.fields.updated_at")}:{" "}
                                {header.updatedAt}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="flex flex-col items-end">
                            <span className="text-[11px] text-[#9ca3af]">
                                Value
                            </span>
                            <span className="text-sm font-medium text-[#1a1f2e]">
                                {header.value}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[11px] text-[#9ca3af]">
                                {t("pages.deals.info.fields.close_date")}
                            </span>
                            <span className="text-sm font-medium text-[#1a1f2e]">
                                {header.closeDate}
                            </span>
                        </div>
                        <DealButton
                            variant="ghost"
                            icon={<DealIcon name="refresh" size={12} />}
                            onClick={onRefresh}
                            loading={isRefreshing}
                            disabled={isRefreshing}
                        >
                            {td("Refresh")}
                        </DealButton>
                    </div>
                </div>

                <div className="flex items-center gap-4 border-t border-[#e2e5ea] py-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#9ca3af]">
                            {t("pages.deals.info.fields.deal_agent")}
                        </span>
                        {team.agent && (
                            <DealAvatar
                                type="agent"
                                size={26}
                                initials={team.agent.initials}
                            />
                        )}
                        <DealBadge variant="blue">
                            {team.agent?.name ?? "--"}
                        </DealBadge>
                    </div>
                    <div className="h-5 w-px bg-[#e2e5ea]" />
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#9ca3af]">
                            {t("pages.deals.info.fields.deal_participants")}
                        </span>
                        <div className="flex items-center">
                            {team.participants
                                .slice(0, 3)
                                .map((participant, idx) => (
                                    <div
                                        key={participant.id}
                                        style={{
                                            marginLeft: idx === 0 ? 0 : -5,
                                        }}
                                    >
                                        <DealAvatar
                                            type="participant"
                                            size={26}
                                            initials={participant.initials}
                                        />
                                    </div>
                                ))}
                            <button
                                type="button"
                                className="ml-[-5px] flex h-[26px] w-[26px] items-center justify-center rounded-full border border-dashed border-[#e2e5ea] bg-[#e8eaed] text-sm text-[#9ca3af] cursor-pointer"
                                onClick={() => team.setTeamModalOpen(true)}
                            >
                                +
                            </button>
                        </div>
                    </div>
                    <div className="h-5 w-px bg-[#e2e5ea]" />
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#9ca3af]">
                            {t("pages.deals.info.fields.deal_watchers")}
                        </span>
                        <div className="flex items-center">
                            {team.watchers.slice(0, 3).map((watcher, idx) => (
                                <div
                                    key={watcher.id}
                                    style={{ marginLeft: idx === 0 ? 0 : -5 }}
                                >
                                    <DealAvatar
                                        type="watcher"
                                        size={26}
                                        initials={watcher.initials}
                                    />
                                </div>
                            ))}
                            <button
                                type="button"
                                className="ml-[-5px] flex h-[26px] w-[26px] items-center justify-center rounded-full border border-dashed border-[#e2e5ea] bg-[#e8eaed] text-sm text-[#9ca3af]"
                                onClick={() => team.setTeamModalOpen(true)}
                            >
                                +
                            </button>
                        </div>
                    </div>
                    <div className="ml-auto">
                        <DealButton
                            variant="ghost"
                            icon={<DealIcon name="users" size={12} />}
                            onClick={() => team.setTeamModalOpen(true)}
                        >
                            {t("pages.deals.info.sections.team")}
                        </DealButton>
                    </div>
                </div>

                <div className="flex items-center overflow-x-auto py-2.5">
                    {pipeline.stages.map((stage, index) => {
                        const isCurrent = stage.id === pipeline.currentStageId;
                        const isDone =
                            (stage.priority ?? 0) < pipeline.currentPriority;
                        const isFuture = !isCurrent && !isDone;
                        return (
                            <div key={stage.id} className="flex items-center">
                                <button
                                    type="button"
                                    className="pipeline-step flex items-center gap-1.5 whitespace-nowrap rounded-[20px] border px-[13px] py-[6px] text-xs"
                                    style={{
                                        fontWeight: isCurrent ? 600 : 500,
                                        background: isFuture
                                            ? T.GRAY
                                            : isCurrent
                                              ? stage.label_color
                                              : `${stage.label_color}22`,
                                        color: isFuture ? T.TEXT_HINT : T.TEXT,
                                        borderColor: isFuture
                                            ? T.GRAY_MID
                                            : stage.label_color,
                                    }}
                                    disabled={
                                        !hasAllPermission(
                                            permissions,
                                            "change_deal_stages",
                                        )
                                    }
                                    onClick={() =>
                                        pipeline.updateStage(stage.id)
                                    }
                                >
                                    <span
                                        className="step-dot inline-block h-1.5 w-1.5 rounded-full"
                                        style={{
                                            background: isFuture
                                                ? T.GRAY_MID
                                                : stage.label_color,
                                            transition: "transform 0.15s",
                                        }}
                                    />
                                    {td(stage.name)}
                                </button>
                                {index < pipeline.stages.length - 1 && (
                                    <span className="h-px w-3.5 flex-shrink-0 bg-[#e8eaed]" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <DealModal
                open={team.teamModalOpen}
                onClose={() => team.setTeamModalOpen(false)}
                title={t("pages.deals.info.sections.team")}
                footer={
                    <DealButton
                        variant="ghost"
                        onClick={() => team.setTeamModalOpen(false)}
                    >
                        {td("Close")}
                    </DealButton>
                }
            >
                <DealModalField label={t("pages.deals.info.fields.deal_agent")}>
                    <select
                        value={team.agent?.id ?? ""}
                        onChange={(event) =>
                            saveTeamField("agent_id", [
                                Number(event.target.value),
                            ])
                        }
                    >
                        <option value="">{td("Unassigned")}</option>
                        {employeeOptions.map((employee: any) => (
                            <option key={employee.id} value={employee.id}>
                                {employee.name}
                            </option>
                        ))}
                    </select>
                </DealModalField>
                <DealModalField
                    label={t("pages.deals.info.fields.deal_participants")}
                >
                    <select
                        multiple
                        value={team.participants.map((item) =>
                            item.id.toString(),
                        )}
                        onChange={(event) =>
                            saveTeamField(
                                "deal_participant",
                                Array.from(event.target.selectedOptions).map(
                                    (option) => Number(option.value),
                                ),
                            )
                        }
                    >
                        {employeeOptions.map((employee: any) => (
                            <option key={employee.id} value={employee.id}>
                                {employee.name}
                            </option>
                        ))}
                    </select>
                </DealModalField>
                <DealModalField
                    label={t("pages.deals.info.fields.deal_watchers")}
                >
                    <select
                        multiple
                        value={team.watchers.map((item) => item.id.toString())}
                        onChange={(event) =>
                            saveTeamField(
                                "deal_watcher",
                                Array.from(event.target.selectedOptions).map(
                                    (option) => Number(option.value),
                                ),
                            )
                        }
                    >
                        {employeeOptions.map((employee: any) => (
                            <option key={employee.id} value={employee.id}>
                                {employee.name}
                            </option>
                        ))}
                    </select>
                </DealModalField>
            </DealModal>
        </div>
    );
}

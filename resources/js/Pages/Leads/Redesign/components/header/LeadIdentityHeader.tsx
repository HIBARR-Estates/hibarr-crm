import DealBadge from "@/Pages/Deals/Redesign/components/primitives/DealBadge";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadIcon from "../primitives/LeadIcon";
import type { LeadHeaderData } from "../../hooks/useLeadHeaderData";
import { LEAD_REDESIGN_TOKENS as T } from "../../types";

interface LeadIdentityHeaderProps {
    header: LeadHeaderData;
    onEditLead: () => void;
    canEdit: boolean;
    onRefresh: () => void;
    isRefreshing: boolean;
    refreshDisabled: boolean;
}

export default function LeadIdentityHeader({
    header,
    onEditLead,
    canEdit,
    onRefresh,
    isRefreshing,
    refreshDisabled,
}: LeadIdentityHeaderProps) {
    const { td } = useTd();

    const assignLabel = header.ownerFirstName
        ? `${td("Assign")} · ${header.ownerFirstName}`
        : td("Assign");

    return (
        <header
            style={{
                background: T.WHITE,
                borderBottom: `1px solid ${T.BORDER}`,
            }}
        >
            <div
                className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-5 py-2.5"
                style={{ flexWrap: "wrap" }}
            >
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h1
                        className="m-0 truncate"
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: T.NAVY,
                        }}
                    >
                        {header.leadName}
                    </h1>

                    <DealBadge variant="gray">#{header.leadId}</DealBadge>

                    {header.languages.map((language) => (
                        <DealBadge key={language} variant="gray">
                            {language}
                        </DealBadge>
                    ))}

                    {header.statusLabel &&
                        (header.statusColor ? (
                            <span
                                style={{
                                    fontSize: 11,
                                    padding: "3px 9px",
                                    borderRadius: 20,
                                    fontWeight: 600,
                                    background: `${header.statusColor}22`,
                                    color: header.statusColor,
                                    border: `1px solid ${header.statusColor}55`,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {header.statusLabel}
                            </span>
                        ) : (
                            <DealBadge
                                variant={
                                    header.statusIsActive ? "green" : "gray"
                                }
                            >
                                {header.statusLabel}
                            </DealBadge>
                        ))}

                    {header.sourceLabel && (
                        <span
                            style={{
                                fontSize: 12.5,
                                color: T.TEXT_MUTED,
                            }}
                        >
                            {header.sourceLabel}
                        </span>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <DealButton
                        variant="ghost"
                        onClick={onRefresh}
                        disabled={refreshDisabled || isRefreshing}
                        icon={<LeadIcon name="refresh" size={12} />}
                        style={{ fontSize: 12 }}
                    >
                        {isRefreshing ? td("Refreshing...") : td("Refresh")}
                    </DealButton>

                    {canEdit && (
                        <DealButton
                            variant="ghost"
                            onClick={onEditLead}
                            style={{ fontSize: 12 }}
                        >
                            {td("Edit lead info")}
                        </DealButton>
                    )}

                    <DealButton
                        variant="ghost"
                        onClick={canEdit ? onEditLead : undefined}
                        disabled={!canEdit}
                        title={
                            header.ownerName
                                ? `${td("Lead owner")}: ${header.ownerName}`
                                : td("Assign lead owner")
                        }
                        style={{ fontSize: 12 }}
                    >
                        {assignLabel}
                    </DealButton>
                </div>
            </div>
        </header>
    );
}

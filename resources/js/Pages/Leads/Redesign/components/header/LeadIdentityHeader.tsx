import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import LeadIcon from "../primitives/LeadIcon";
import type { LeadHeaderData } from "../../hooks/useLeadHeaderData";

interface LeadIdentityHeaderProps {
    header: LeadHeaderData;
    onEditLead: () => void;
    canEdit: boolean;
}

export default function LeadIdentityHeader({
    header,
    onEditLead,
    canEdit,
}: LeadIdentityHeaderProps) {
    return (
        <header className="border-b border-[#e2e5ea] bg-white px-[26px] py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-semibold text-[#1a1f2e]">
                            {header.leadName}
                        </h1>
                        <span className="rounded bg-[#f5f6f8] px-2 py-0.5 text-[11px] font-medium text-[#6b7280]">
                            #{header.leadId}
                        </span>
                        {header.lifecycleLabel && (
                            <span
                                className="rounded px-2 py-0.5 text-[11px] font-semibold"
                                style={{
                                    backgroundColor: header.lifecycleColor
                                        ? `${header.lifecycleColor}22`
                                        : "#e8f1fb",
                                    color: header.lifecycleColor ?? "#1a6bb5",
                                }}
                            >
                                {header.lifecycleLabel}
                            </span>
                        )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#6b7280]">
                        {header.language && (
                            <span>{header.language}</span>
                        )}
                        {header.sourceLabel && (
                            <span className="inline-flex items-center gap-1">
                                <LeadIcon name="target" size={12} />
                                {header.sourceLabel}
                            </span>
                        )}
                        {header.ownerName && (
                            <span className="inline-flex items-center gap-1">
                                <LeadIcon name="user" size={12} />
                                {header.ownerName}
                            </span>
                        )}
                    </div>
                </div>
                {canEdit && (
                    <DealButton variant="ghost" onClick={onEditLead}>
                        <LeadIcon name="edit" size={13} />
                        Edit lead info
                    </DealButton>
                )}
            </div>
        </header>
    );
}

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { Lead } from "@/Types/api/leads";
import { initialsFromName } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ResolvedLifecycle } from "../../adapters/lifecycleAdapter";
import type { MoreMenuActionId } from "../../config/moreMenuItems";
import LeadAvatarButton from "./LeadAvatarButton";
import LifecycleBanner from "./LifecycleBanner";
import MoreMenu from "./MoreMenu";
import StatusDropdown, { type LeadStatusOption } from "./StatusDropdown";

dayjs.extend(relativeTime);

interface LeadHeaderRootProps {
    lead: Lead;
    lifecycle: ResolvedLifecycle;
    statuses: LeadStatusOption[];
    valueLabel?: string | null;
    answerCount?: number;
    firstName: string;
    templateName?: string | null;
    qualificationAnswered?: number;
    qualificationTotal?: number;
    canDelete?: boolean;
    onStatusChange: (key: string) => void;
    statusSaving?: boolean;
    onOpenAnswers?: () => void;
    onMoreAction: (id: MoreMenuActionId) => void;
    onBannerPrimary: () => void;
    onBannerViewAnswers?: () => void;
}

export default function LeadHeaderRoot({
    lead,
    lifecycle,
    statuses,
    valueLabel,
    answerCount = 0,
    firstName,
    templateName,
    qualificationAnswered,
    qualificationTotal,
    canDelete = true,
    onStatusChange,
    statusSaving = false,
    onOpenAnswers,
    onMoreAction,
    onBannerPrimary,
    onBannerViewAnswers,
}: LeadHeaderRootProps) {
    const { td } = useTd();

    const ownerName = lead.lead_owner?.name ?? td("Unassigned");
    const ownerInitials = initialsFromName(lead.lead_owner?.name);
    const createdAgo = lead.created_at
        ? dayjs(lead.created_at).fromNow()
        : null;
    const sourceLabel =
        lead.lead_source?.type ||
        lead.leadSource?.type ||
        (lead as { source_name?: string }).source_name ||
        null;

    const submetaParts = [
        `#${lead.id}`,
        createdAgo ? `${td("created")} ${createdAgo}` : null,
        sourceLabel ? `${td("via")} ${sourceLabel}` : null,
    ].filter(Boolean);

    return (
        <>
            <header
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                }}
            >
                <LeadAvatarButton
                    name={lead.client_name ?? ""}
                    imageUrl={lead.image_url}
                    initials={initialsFromName(lead.client_name)}
                />

                <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                        }}
                    >
                        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                            {lead.client_name_salutation || lead.client_name}
                        </h1>
                        <StatusDropdown
                            statusKey={lifecycle.statusKey}
                            statusLabel={lifecycle.statusLabel}
                            tone={lifecycle.tone}
                            statuses={statuses}
                            onSelect={onStatusChange}
                            saving={statusSaving}
                        />
                        {valueLabel ? (
                            <span className="v2-pill v2-pill-green">
                                {valueLabel}
                            </span>
                        ) : (
                            <span
                                style={{
                                    fontSize: 12,
                                    color: "var(--lr-text-dim)",
                                }}
                            >
                                {td("Value not set")}
                            </span>
                        )}
                        {answerCount > 0 && onOpenAnswers && (
                            <button
                                type="button"
                                className="v2-btn v2-btn-ghost"
                                style={{ padding: "5px 10px", fontSize: 12 }}
                                onClick={onOpenAnswers}
                            >
                                {td("Qualification answers")}
                                <span
                                    className="v2-pill v2-pill-gray"
                                    style={{ marginLeft: 2 }}
                                >
                                    {answerCount}
                                </span>
                            </button>
                        )}
                    </div>
                    <div
                        style={{
                            fontSize: 12,
                            color: "var(--lr-text-dim)",
                            marginTop: 3,
                        }}
                    >
                        {submetaParts.join(" · ")}
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: "var(--lr-surface)",
                        border: "1px solid var(--lr-border)",
                        borderRadius: 10,
                        padding: "8px 12px 8px 8px",
                    }}
                >
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "var(--lr-navy)",
                            color: "var(--lr-white)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                        }}
                    >
                        {ownerInitials}
                    </div>
                    <div>
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "var(--lr-text-dim)",
                            }}
                        >
                            {td("Lead owner")}
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 650,
                                color: "var(--lr-text)",
                            }}
                        >
                            {ownerName}
                        </div>
                    </div>
                    <MoreMenu onAction={onMoreAction} canDelete={canDelete} />
                </div>
            </header>

            <LifecycleBanner
                mode={lifecycle.bannerMode}
                statusLabel={lifecycle.statusLabel}
                statusKey={lifecycle.statusKey}
                firstName={firstName}
                description={
                    (lead.lead_lifecycle_status as { description?: string })
                        ?.description
                }
                templateName={templateName}
                answered={qualificationAnswered}
                total={qualificationTotal}
                onPrimary={onBannerPrimary}
                onViewAnswers={onBannerViewAnswers}
            />
        </>
    );
}

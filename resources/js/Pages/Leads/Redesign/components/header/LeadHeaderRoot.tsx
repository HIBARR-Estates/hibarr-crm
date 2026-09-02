import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { Lead } from "@/Types/api/leads";
import { initialsFromName } from "@/Components/Redesign";
import EditableTitle from "@/Components/Redesign/primitives/EditableTitle";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ResolvedLifecycle } from "../../adapters/lifecycleAdapter";
import {
    formatLeadTemperature,
    LEAD_TEMPERATURE_TONE,
} from "../../config/leadTemperature";
import type { MoreMenuActionId } from "../../config/moreMenuItems";
import useLeadInfoFieldUpdate from "../../hooks/useLeadInfoFieldUpdate";
import LeadAvatarButton from "./LeadAvatarButton";
import LeadOwnerCard from "./LeadOwnerCard";
import LifecycleBanner from "./LifecycleBanner";
import MoreMenu from "./MoreMenu";
import StatusDropdown, { type LeadStatusOption } from "./StatusDropdown";

dayjs.extend(relativeTime);

interface LeadHeaderRootProps {
    lead: Lead;
    lifecycle: ResolvedLifecycle;
    statuses: LeadStatusOption[];
    valueLabel?: string | null;
    firstName: string;
    templateName?: string | null;
    qualificationAnswered?: number;
    qualificationTotal?: number;
    canDelete?: boolean;
    canFindDuplicates?: boolean;
    canEditOwner?: boolean;
    canEdit?: boolean;
    canUploadPhoto?: boolean;
    /** When false, hides the lifecycle/qualification banner and answers chip. */
    showQualification?: boolean;
    /** Omitted when the product-tour flag is off — hides Replay guide. */
    onReplayGuide?: () => void;
    onStatusChange: (key: string) => void;
    statusSaving?: boolean;
    onMoreAction: (id: MoreMenuActionId) => void;
    onBannerPrimary: () => void;
    onBannerSecondary?: () => void;
    onBannerViewAnswers?: () => void;
    /** True while a qualification call is being started/resumed — disables the banner's primary CTA. */
    bannerBusy?: boolean;
    dealCount?: number;
}

export default function LeadHeaderRoot({
    lead,
    lifecycle,
    statuses,
    firstName,
    templateName,
    qualificationAnswered,
    qualificationTotal,
    canDelete = true,
    canFindDuplicates = false,
    canEditOwner = true,
    canEdit = false,
    canUploadPhoto = false,
    showQualification = true,
    onReplayGuide,
    onStatusChange,
    statusSaving = false,
    onMoreAction,
    onBannerPrimary,
    onBannerSecondary,
    onBannerViewAnswers,
    bannerBusy = false,
    dealCount = 0,
}: LeadHeaderRootProps) {
    const { td } = useTd();
    const { handleFieldUpdate } = useLeadInfoFieldUpdate(canEdit);

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
        createdAgo ? `${td("created", { source: "en" })} ${createdAgo}` : null,
        sourceLabel ? `${td("via", { source: "en" })} ${sourceLabel}` : null,
    ].filter(Boolean);

    return (
        <>
            <header
                data-tour="lead-sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                }}
            >
                <LeadAvatarButton
                    name={lead.client_name ?? ""}
                    image={lead.image}
                    imageUrl={lead.image_url}
                    initials={initialsFromName(lead.client_name)}
                    canUpload={canUploadPhoto}
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
                        <EditableTitle
                            value={lead.client_name ?? ""}
                            prefix={salutationPrefix(lead)}
                            canEdit={canEdit}
                            ariaLabel={td("Lead name", { source: "en" })}
                            onSave={(next) =>
                                handleFieldUpdate("client_name", next)
                            }
                        />
                        <StatusDropdown
                            statusKey={lifecycle.statusKey}
                            statusLabel={lifecycle.statusLabel}
                            tone={lifecycle.tone}
                            statuses={statuses}
                            onSelect={onStatusChange}
                            saving={statusSaving}
                        />
                        {lead.temperature && (
                            <span
                                className={`v2-pill v2-pill-${LEAD_TEMPERATURE_TONE[lead.temperature]}`}
                            >
                                {formatLeadTemperature(lead.temperature)}
                            </span>
                        )}
                        <MoreMenu
                            onAction={onMoreAction}
                            canDelete={canDelete}
                            canFindDuplicates={canFindDuplicates}
                            onReplayGuide={onReplayGuide}
                        />
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

                <LeadOwnerCard lead={lead} canEdit={canEditOwner} />
            </header>

            {showQualification ? (
                <div data-tour="lead-lifecycle-banner">
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
                        dealCount={dealCount}
                        busy={bannerBusy}
                        onPrimary={onBannerPrimary}
                        onSecondary={onBannerSecondary}
                        onViewAnswers={onBannerViewAnswers}
                    />
                </div>
            ) : null}
        </>
    );
}

/** Idle title is "Mr. Jane Doe"; only `client_name` is editable. */
function salutationPrefix(lead: Lead): string | undefined {
    const name = (lead.client_name ?? "").trim();
    const full = (lead.client_name_salutation ?? "").trim();
    if (!name || !full || full === name || !full.endsWith(name)) {
        return undefined;
    }
    return full.slice(0, full.length - name.length);
}

import { useTd } from "@/Hooks/useDynamicTranslation";
import { formatMobileForDisplay } from "@/lib/utils";
import type { Deal } from "@/Types/api/deals";
import type { Lead } from "@/Types/api/leads";
import type { QualificationLeadPatch } from "@/Types/qualification";
import { useLeadWorkspace } from "../../context/LeadWorkspaceContext";
import type { LeadMissionFlow } from "../../hooks/useLeadMissionFlow";
import type useLeadDealCreate from "../../hooks/useLeadDealCreate";
import type useLeadQualificationWorkspace from "../../hooks/useLeadQualificationWorkspace";
import type { LeadRedesignProps } from "../../types";
import CreateDealModal from "../dealCreate/CreateDealModal";
import QualifyModal from "./QualifyModal";
import TemplatePickerModal from "./TemplatePickerModal";

type DealMetaProps = Pick<
    LeadRedesignProps,
    | "fields"
    | "customFieldCategories"
    | "editLeadPermission"
    | "meetingTypes"
    | "leadAgents"
    | "categories"
    | "packages"
    | "products"
    | "leadPipelines"
    | "leadStages"
    | "stages"
>;

interface LeadMissionModalsProps {
    flow: LeadMissionFlow;
    qualification: ReturnType<typeof useLeadQualificationWorkspace>;
    dealCreate: ReturnType<typeof useLeadDealCreate>;
    /** crm.lead-qualification-tab: without it there is no picker or call. */
    showQualification: boolean;
    qualificationOpen: boolean;
    onCloseQualification: () => void;
    pageProps: DealMetaProps;
    /** After a deal (and its kickoff meeting, if any) is created. */
    onDealCreated?: (deal: Deal) => void;
    /** Where the qualification call opens: "under-dock" on the agent workspace. */
    qualificationPlacement?: "center" | "under-dock";
}

/**
 * The template picker, the qualification call (QualifyModal) and the
 * create-deal form, driven by useLeadMissionFlow. Lead changes the call
 * makes are merged into LeadWorkspaceContext, so nothing reloads.
 */
export default function LeadMissionModals({
    flow,
    qualification,
    dealCreate,
    showQualification,
    qualificationOpen,
    onCloseQualification,
    pageProps: props,
    onDealCreated,
    qualificationPlacement,
}: LeadMissionModalsProps) {
    const { td } = useTd();
    const { lead, setLead } = useLeadWorkspace();

    const defaultAgentId = (() => {
        const agents = props.leadAgents ?? [];
        const ownerUserId = lead.lead_owner?.id;
        if (!ownerUserId) return null;
        const match = agents.find(
            (agent: { id: number; user_id?: number; user?: { id?: number } }) =>
                agent.user_id === ownerUserId || agent.user?.id === ownerUserId,
        );
        return match?.id ?? null;
    })();

    return (
        <>
            {showQualification && (
                <>
                    <TemplatePickerModal
                        open={flow.templatePickerOpen}
                        leadName={lead.client_name ?? td("Lead", { source: "en" })}
                        templates={qualification.templates}
                        loading={qualification.templatesLoading}
                        selecting={qualification.isStartingFlow}
                        onClose={flow.closeTemplatePicker}
                        onSelect={(id) => void flow.handleTemplateSelect(id)}
                    />

                    {qualificationOpen && (
                        <QualifyModal
                            open={qualificationOpen}
                            lead={lead}
                            qualification={qualification.current}
                            templateTree={qualification.templateTree}
                            treeLoading={qualification.treeLoading}
                            starting={qualification.isStartingFlow}
                            fields={props.fields}
                            customFieldCategories={props.customFieldCategories}
                            editLeadPermission={props.editLeadPermission}
                            meetingTypes={props.meetingTypes ?? []}
                            placement={qualificationPlacement}
                            onClose={onCloseQualification}
                            onCompleted={(updated) => {
                                qualification.handleQualificationUpdated(updated);
                            }}
                            onActionsDone={(updated) => {
                                qualification.finishQualificationSession(updated);
                            }}
                            onLeadUpdated={(patch) => {
                                setLead((prev) => mergeQualificationLeadPatch(prev, patch));
                            }}
                        />
                    )}
                </>
            )}

            <CreateDealModal
                open={flow.createDealOpen}
                onClose={() => {
                    flow.closeCreateDeal();
                    dealCreate.clearErrors();
                }}
                saving={dealCreate.isCreating}
                errors={dealCreate.errors}
                defaultAgentId={defaultAgentId}
                meetingTypes={props.meetingTypes ?? []}
                dealMeta={{
                    categories: props.categories,
                    packages: props.packages,
                    products: props.products,
                    pipelines: props.leadPipelines,
                    stages: props.leadStages ?? props.stages,
                    leadAgents: props.leadAgents,
                }}
                onSubmit={(input) =>
                    dealCreate.createDeal(input, (deal) => {
                        flow.closeCreateDeal();
                        onDealCreated?.(deal);
                    })
                }
            />
        </>
    );
}

/** Apply the qualification-complete lead patch into workspace state (no reload). */
function mergeQualificationLeadPatch(prev: Lead, patch: QualificationLeadPatch): Lead {
    const next = { ...prev } as Record<string, unknown>;

    Object.entries(patch).forEach(([key, val]) => {
        if (val === undefined) return;
        next[key] =
            (key === "languages" || key === "categories" || key === "category_ids") && !Array.isArray(val)
                ? []
                : val;
    });

    const lifecycle = patch.lead_lifecycle_status ?? patch.lifecycleStatus;
    if (lifecycle != null) {
        next.lead_lifecycle_status = lifecycle;
        next.lifecycleStatus = lifecycle;
    }

    if (patch.custom_fields_data && typeof patch.custom_fields_data === "object") {
        next.custom_fields_data = patch.custom_fields_data;
    }

    if (patch.mobile !== undefined) {
        const formatted = formatMobileForDisplay(String(patch.mobile ?? ""));
        next.mobile_with_phonecode =
            formatted && formatted !== "--"
                ? formatted
                : (patch.mobile_with_phonecode as string | undefined) ?? "--";
    }

    if (patch.office !== undefined) {
        const formatted = formatMobileForDisplay(String(patch.office ?? ""));
        next.office_phone_formatted =
            formatted && formatted !== "--"
                ? formatted
                : (patch.office_phone_formatted as string | undefined) || String(patch.office ?? "") || "--";
    }

    return next as unknown as Lead;
}

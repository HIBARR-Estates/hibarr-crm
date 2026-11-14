import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import {
    filterCategoriesByScope,
    resolveScopedFieldKeys,
} from "@/Features/Deals/pipelineScopeUtils";
import {
    buildScriptItems,
    computeAnalysisProgress,
} from "../components/analysis/analysisProgress";
import { useDealWorkspace } from "../context/DealWorkspaceContext";
import type { DealShowProps } from "../types";
import useDealPipeline from "./useDealPipeline";
import usePipelineHasPackages from "./usePipelineHasPackages";

/** Stable identity so an absent prop doesn't invalidate memos every render. */
const EMPTY_FIELDS: any[] = [];

/**
 * What a deal page derives from its props and DealWorkspaceContext before it
 * renders anything: the pipeline/stage-scoped info categories and field keys,
 * analysis progress, file-field visibility, the viewer's deal permissions and
 * the stage mutation. Shared by the deal page and the agent workspace's
 * contact page in its deal state, so both read the same numbers.
 */
export default function useDealWorkspaceModel(props: DealShowProps) {
    const { props: pageProps } = usePage<PageProps>();
    const { deal } = useDealWorkspace();
    const meetingTypes = props.meetingTypes ?? [];
    const permissions = props.permissions ?? {};
    const isAdminRole = useIsAdminRole();
    const fields = props.fields ?? [];
    const customFieldCategories = props.customFieldCategories ?? [];
    // NOT pipeline-filtered — this is the raw company-wide category list, kept
    // as-is here since it feeds the Files tab/context-rail document slots.
    const pipelineCategoryIds = useMemo(
        () =>
            customFieldCategories.map((category: { id: number }) =>
                Number(category.id),
            ),
        [customFieldCategories],
    );

    // Deal Info tab needs the actual pipeline/stage-scoped subset — mirrors
    // the legacy DealInfoSection.tsx pattern (pipelineScopeUtils.ts helpers).
    const pipelineCategoryScopeMap = pageProps.pipelineCategoryScopeMap ?? {};
    const pipelineFieldScopeMap = pageProps.pipelineFieldScopeMap ?? {};
    const hideAllCategoriesPipelineIds =
        pageProps.hideAllCategoriesPipelineIds ?? [];
    const stages = pageProps.stages ?? [];
    const scopedCategoryIdsFromServer =
        pageProps.scopedCustomFieldCategoryIds ?? null;
    const scopedDealFieldKeysFromServer = pageProps.visibleDealFieldKeys as
        | string[]
        | null
        | undefined;

    const dealInfoCategories = useMemo(
        () =>
            filterCategoriesByScope(
                customFieldCategories,
                pipelineCategoryScopeMap,
                deal.lead_pipeline_id,
                deal.pipeline_stage_id,
                stages,
                scopedCategoryIdsFromServer,
                hideAllCategoriesPipelineIds,
            ),
        [
            customFieldCategories,
            pipelineCategoryScopeMap,
            deal.lead_pipeline_id,
            deal.pipeline_stage_id,
            stages,
            scopedCategoryIdsFromServer,
            hideAllCategoriesPipelineIds,
        ],
    );

    // Analysis progress off saved values, so the status card reports the same
    // totals as the modal header. Recomputed when the deal reloads on modal close.
    // leadCustomFields must be passed or `lead_custom_field` steps resolve to no
    // field at all and silently drop out of the denominator here but not in the
    // modal — the two would then disagree.
    const analysisProgress = useMemo(
        () =>
            computeAnalysisProgress(
                buildScriptItems(props.analysisScript, dealInfoCategories),
                fields,
                {
                    ...(deal.custom_fields_data ?? {}),
                    ...((pageProps.leadCustomFieldsData as Record<
                        string,
                        any
                    >) ?? {}),
                },
                deal,
                (pageProps.leadCustomFields as any[] | null | undefined) ??
                    EMPTY_FIELDS,
            ),
        [
            props.analysisScript,
            dealInfoCategories,
            fields,
            deal,
            pageProps.leadCustomFieldsData,
            pageProps.leadCustomFields,
        ],
    );

    const dealInfoFieldKeys = useMemo(
        () =>
            scopedDealFieldKeysFromServer !== undefined
                ? scopedDealFieldKeysFromServer
                : resolveScopedFieldKeys(
                      pipelineFieldScopeMap,
                      "App\\Models\\Deal",
                      deal.lead_pipeline_id,
                      deal.pipeline_stage_id,
                      stages,
                  ),
        [
            scopedDealFieldKeysFromServer,
            pipelineFieldScopeMap,
            deal.lead_pipeline_id,
            deal.pipeline_stage_id,
            stages,
        ],
    );
    const employees = props.employees ?? [];
    const taskBoardColumns = props.taskBoardColumns ?? [];
    const dealPermissions = useDealPermissions(deal);
    const pipelineHasPackages = usePipelineHasPackages();
    // Wire the AI summary's ADVANCE_STAGE action to a real stage change (the
    // same mutation the pipeline stepper uses). Only actionable when the user
    // may change stages — otherwise the summary card renders it as advice, not
    // a dead button.
    const canChangeStages = permissions.change_deal_stages === "all";
    const canCreatePaymentRequest = dealPermissions.canEdit;
    // Mirrors DealPaymentService::canConfirmTransfer — the admin role passes
    // even without an edit_payments row.
    const canConfirmPaymentTransfer =
        isAdminRole || permissions.edit_payments === "all";
    const pipeline = useDealPipeline(deal, canChangeStages);
    const advanceToNextStage = useMemo(() => {
        if (!canChangeStages) return undefined;
        const ordered = [...pipeline.stages].sort(
            (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
        );
        const currentIndex = ordered.findIndex(
            (stage) => stage.id === pipeline.currentStageId,
        );
        const next = ordered[currentIndex + 1];
        if (!next) return undefined;
        return () => pipeline.updateStage(next.id);
    }, [canChangeStages, pipeline]);

    // Lead-owned FILE fields, whose value lives on the lead (shared across
    // every deal on that lead) — one slot on this deal's Files tab, gated by
    // the same visibility rules as any other custom file field.
    const leadFileFields = useMemo(
        () =>
            (
                (pageProps.leadCustomFields as any[] | null | undefined) ??
                EMPTY_FIELDS
            ).filter((f: any) => f.type === "file"),
        [pageProps.leadCustomFields],
    );
    const leadFileFieldsData =
        (pageProps.leadCustomFieldsData as
            | Record<string, any>
            | null
            | undefined) ?? {};

    // Deal-context visibility for this deal's own + lead-owned file fields.
    // Pipeline/stage context is the deal's for both, but `record` criteria are
    // scoped to the record that *owns* the field: a lead field's "restrict to
    // specific record(s)" rule lists lead ids, so evaluating it against the
    // deal id would never match. Hence two passes over one shared value map.
    const dealFileVisibilityMap = useMemo(() => {
        const fileRelevantFields = [...fields, ...leadFileFields];
        const customFieldsData = {
            ...(deal.custom_fields_data ?? {}),
            ...leadFileFieldsData,
        };
        const baseContext = {
            pipeline: deal.lead_pipeline_id,
            pipelineStage: deal.pipeline_stage_id,
        };
        const evaluateFor = (targetFields: any[], recordId: any) =>
            evaluateAllFieldsVisibility(
                targetFields,
                buildFieldValueMap({
                    customFieldsData,
                    fields: fileRelevantFields,
                    normalizeMultiSelect: true,
                    context: { ...baseContext, recordId },
                }),
            );

        return {
            ...evaluateFor(fields, deal.id),
            ...evaluateFor(leadFileFields, deal.lead_id),
        };
    }, [
        fields,
        leadFileFields,
        deal.id,
        deal.lead_id,
        deal.custom_fields_data,
        leadFileFieldsData,
        deal.lead_pipeline_id,
        deal.pipeline_stage_id,
    ]);

    return {
        meetingTypes,
        permissions,
        isAdminRole,
        fields,
        pipelineCategoryIds,
        dealInfoCategories,
        analysisProgress,
        dealInfoFieldKeys,
        employees,
        taskBoardColumns,
        dealPermissions,
        pipelineHasPackages,
        canChangeStages,
        canCreatePaymentRequest,
        canConfirmPaymentTransfer,
        pipeline,
        advanceToNextStage,
        leadFileFields,
        leadFileFieldsData,
        dealFileVisibilityMap,
    };
}

export type DealWorkspaceModel = ReturnType<typeof useDealWorkspaceModel>;

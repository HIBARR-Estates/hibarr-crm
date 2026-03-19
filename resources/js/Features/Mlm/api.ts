import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type {
    MlmLevel,
    MlmLevelFormData,
    MlmLevelCriterion,
    MlmLevelCriterionFormData,
    MlmCommission,
    AgentMetricWithProgress,
    AgentLevelHistory,
    AgentHierarchyNode,
    CommissionSimulationResult,
    CommissionSimulationRequest,
    MlmAdminDashboardStats,
    MlmAgentDashboardStats,
    MlmSettings,
    PaginatedResponse,
    MlmCycle,
    MlmCycleFormData,
    ActiveCycleSummary,
    AgentCycleEnrollment,
    MyEnrollmentData,
} from "./types";
import { ApiResponse } from "@/lib/api/types";

// ── Base Paths ───────────────────────────────────────────────────
const ADMIN_API = "/account/mlm/api";
const AGENT_API = "/account/mlm/agent/api";

// ══════════════════════════════════════════════════════════════════
// ADMIN QUERIES
// ══════════════════════════════════════════════════════════════════

/** Admin dashboard stats */
export const useMlmAdminDashboard = () =>
    useApiQuery<MlmAdminDashboardStats>({
        path: `${ADMIN_API}/dashboard-stats`,
    });

/** All MLM levels with criteria */
export const useMlmLevels = () =>
    useApiQuery<{ data: MlmLevel[] }>({
        path: `${ADMIN_API}/levels`,
    });

/** Single level with criteria */
export const useMlmLevel = (id: number) =>
    useApiQuery<{ data: MlmLevel }>({
        path: `${ADMIN_API}/levels/${id}`,
        options: { enabled: id > 0 },
    });

/** Criteria for a specific level */
export const useMlmLevelCriteria = (levelId: number) =>
    useApiQuery<{ data: MlmLevelCriterion[] }>({
        path: `${ADMIN_API}/levels/${levelId}/criteria`,
        options: { enabled: levelId > 0 },
    });

/** Commission ledger with pagination & filters */
export const useMlmCommissions = (
    params: Record<string, string | number | boolean> = {},
) =>
    useApiQuery<PaginatedResponse<MlmCommission>>({
        path: `${ADMIN_API}/commissions`,
        params,
    });

/** Agent metrics listing */
export const useAgentMetrics = (
    params: Record<string, string | number | boolean> = {},
) =>
    useApiQuery<PaginatedResponse<AgentMetricWithProgress>>({
        path: `${ADMIN_API}/agent-metrics`,
        params,
    });

/** Level assignment history */
export const useLevelHistory = (
    params: Record<string, string | number | boolean> = {},
) =>
    useApiQuery<PaginatedResponse<AgentLevelHistory>>({
        path: `${ADMIN_API}/level-history`,
        params,
    });

/** Agent hierarchy tree */
export const useAgentHierarchy = (
    params: Record<string, string | number | boolean> = {},
) =>
    useApiQuery<{ data: AgentHierarchyNode[] }>({
        path: `${ADMIN_API}/hierarchy`,
        params,
    });

/** MLM global settings */
export const useMlmSettings = () =>
    useApiQuery<{ data: MlmSettings }>({
        path: `${ADMIN_API}/settings`,
    });

/** Commission simulation */
export const useCommissionSimulation = (
    params: Record<string, string | number | boolean>,
) =>
    useApiQuery<{ data: CommissionSimulationResult }>({
        path: `${ADMIN_API}/simulate`,
        params,
        options: {
            enabled:
                Number(params.deal_value) > 0 && Number(params.agent_id) > 0,
        },
    });

// ══════════════════════════════════════════════════════════════════
// ADMIN CYCLE QUERIES
// ══════════════════════════════════════════════════════════════════

/** Active cycle summary */
export const useActiveCycle = () =>
    useApiQuery<{ data: ActiveCycleSummary }>({
        path: `${ADMIN_API}/cycles/active`,
    });

/** Paginated cycles list */
export const useMlmCycles = (
    params: Record<string, string | number | boolean> = {},
) =>
    useApiQuery<PaginatedResponse<MlmCycle>>({
        path: `${ADMIN_API}/cycles`,
        params,
    });

/** Cycle detail with enrollments */
export const useMlmCycleDetail = (id: number) =>
    useApiQuery<{
        data: {
            cycle: MlmCycle;
            enrollments: AgentCycleEnrollment[];
        };
    }>({
        path: `${ADMIN_API}/cycles/${id}`,
        options: { enabled: id > 0 },
    });

// ══════════════════════════════════════════════════════════════════
// ADMIN MUTATIONS
// ══════════════════════════════════════════════════════════════════

/** Create a new MLM level */
export const useCreateMlmLevel = (onSuccess?: (res?: any) => void) =>
    useApiMutate<MlmLevelFormData, MlmLevel, ApiResponse<MlmLevel>>(
        `${ADMIN_API}/levels`,
        "POST",
        onSuccess,
    );

/** Update an MLM level */
export const useUpdateMlmLevel = (
    id: number,
    onSuccess?: (res?: any) => void,
) =>
    useApiMutate<MlmLevelFormData, MlmLevel, ApiResponse<MlmLevel>>(
        `${ADMIN_API}/levels/${id}`,
        "PUT",
        onSuccess,
    );

/** Delete an MLM level */
export const useDeleteMlmLevel = (
    id: number,
    onSuccess?: (res?: any) => void,
) =>
    useApiMutate<{}, void, ApiResponse<void>>(
        `${ADMIN_API}/levels/${id}`,
        "DELETE",
        onSuccess,
    );

/** Reorder MLM levels (batch rank update) */
export const useReorderMlmLevels = (onSuccess?: (res?: any) => void) =>
    useApiMutate<
        { levels: Array<{ id: number; rank: number }> },
        void,
        ApiResponse<void>
    >(`${ADMIN_API}/levels/reorder`, "POST", onSuccess);

/** Create a level criterion */
export const useCreateLevelCriterion = (onSuccess?: (res?: any) => void) =>
    useApiMutate<
        MlmLevelCriterionFormData,
        MlmLevelCriterion,
        ApiResponse<MlmLevelCriterion>
    >(`${ADMIN_API}/criteria`, "POST", onSuccess);

/** Update a level criterion */
export const useUpdateLevelCriterion = (
    id: number,
    onSuccess?: (res?: any) => void,
) =>
    useApiMutate<
        Partial<MlmLevelCriterionFormData>,
        MlmLevelCriterion,
        ApiResponse<MlmLevelCriterion>
    >(`${ADMIN_API}/criteria/${id}`, "PUT", onSuccess);

/** Delete a level criterion */
export const useDeleteLevelCriterion = (
    id: number,
    onSuccess?: (res?: any) => void,
) =>
    useApiMutate<{}, void, ApiResponse<void>>(
        `${ADMIN_API}/criteria/${id}`,
        "DELETE",
        onSuccess,
    );

/** Mark commission as paid */
export const useMarkCommissionPaid = (
    id: number,
    onSuccess?: (res?: any) => void,
) =>
    useApiMutate<{}, MlmCommission, ApiResponse<MlmCommission>>(
        `${ADMIN_API}/commissions/${id}/mark-paid`,
        "POST",
        onSuccess,
    );

/** Bulk mark commissions as paid */
export const useBulkMarkCommissionsPaid = (onSuccess?: (res?: any) => void) =>
    useApiMutate<{ ids: number[] }, void, ApiResponse<void>>(
        `${ADMIN_API}/commissions/bulk-mark-paid`,
        "POST",
        onSuccess,
    );

/** Revert a commission */
export const useRevertCommission = (
    id: number,
    onSuccess?: (res?: any) => void,
) =>
    useApiMutate<{ reason: string }, MlmCommission, ApiResponse<MlmCommission>>(
        `${ADMIN_API}/commissions/${id}/revert`,
        "POST",
        onSuccess,
    );

/** Update MLM settings */
export const useUpdateMlmSettings = (onSuccess?: (res?: any) => void) =>
    useApiMutate<MlmSettings, MlmSettings, ApiResponse<MlmSettings>>(
        `${ADMIN_API}/settings`,
        "PUT",
        onSuccess,
    );

/** Assign downline (set parent) */
export const useAssignDownline = (onSuccess?: (res?: any) => void) =>
    useApiMutate<
        { child_agent_id: number; parent_agent_id: number },
        void,
        ApiResponse<void>
    >(`${ADMIN_API}/hierarchy/assign`, "POST", onSuccess);

/** Remove hierarchy relationship */
export const useRemoveHierarchy = (
    agentId: number,
    onSuccess?: (res?: any) => void,
) =>
    useApiMutate<{}, void, ApiResponse<void>>(
        `${ADMIN_API}/hierarchy/${agentId}/remove`,
        "POST",
        onSuccess,
    );

/** Update cycle configuration */
export const useCreateCycle = (onSuccess?: (res?: any) => void) =>
    useApiMutate<MlmCycleFormData, MlmCycle, ApiResponse<MlmCycle>>(
        `${ADMIN_API}/cycles`,
        "POST",
        onSuccess,
    );

/** Update an existing cycle (upcoming only) */
export const useUpdateCycle = (id: number, onSuccess?: (res?: any) => void) =>
    useApiMutate<Partial<MlmCycleFormData>, MlmCycle, ApiResponse<MlmCycle>>(
        `${ADMIN_API}/cycles/${id}`,
        "PUT",
        onSuccess,
    );

/** Delete a cycle (upcoming + zero enrollments only) */
export const useDeleteCycle = (id: number, onSuccess?: (res?: any) => void) =>
    useApiMutate<{}, void, ApiResponse<void>>(
        `${ADMIN_API}/cycles/${id}`,
        "DELETE",
        onSuccess,
    );

/** Force-complete an enrollment */
export const useForceCompleteEnrollment = (
    cycleId: number,
    enrollmentId: number,
    onSuccess?: (res?: any) => void,
) =>
    useApiMutate<{}, void, ApiResponse<void>>(
        `${ADMIN_API}/cycles/${cycleId}/enrollments/${enrollmentId}/force-complete`,
        "POST",
        onSuccess,
    );

// ══════════════════════════════════════════════════════════════════
// AGENT QUERIES (read-only)
// ══════════════════════════════════════════════════════════════════

/** Agent's own dashboard stats */
export const useMlmAgentDashboard = () =>
    useApiQuery<MlmAgentDashboardStats>({
        path: `${AGENT_API}/dashboard-stats`,
    });

/** Agent's own commissions */
export const useMyCommissions = (
    params: Record<string, string | number | boolean> = {},
) =>
    useApiQuery<PaginatedResponse<MlmCommission>>({
        path: `${AGENT_API}/commissions`,
        params,
    });

/** Agent's downline network tree */
export const useMyNetwork = () =>
    useApiQuery<{ data: AgentHierarchyNode }>({
        path: `${AGENT_API}/network`,
    });

/** Agent's upline chain */
export const useMyUplines = () =>
    useApiQuery<{ data: AgentHierarchyNode[] }>({
        path: `${AGENT_API}/uplines`,
    });

/** Agent's level details + progress */
export const useMyLevel = () =>
    useApiQuery<{
        data: {
            current_level: MlmLevel | null;
            next_level: MlmLevel | null;
            metrics: { nsa: number; nsd: number; vsa: number; vsd: number };
            criteria_progress: Array<{
                criterion: MlmLevelCriterion;
                current_value: number;
                target_value: number;
                met: boolean;
                percentage: number;
            }>;
            level_history: AgentLevelHistory[];
        };
    }>({
        path: `${AGENT_API}/my-level`,
    });

/** Agent's deal contributions */
export const useMyDealContributions = (
    params: Record<string, string | number | boolean> = {},
) =>
    useApiQuery<
        PaginatedResponse<{
            deal_id: number;
            deal_name: string;
            closed_by: string;
            closed_by_self: boolean;
            deal_value: number;
            commission_amount: number;
            commission_type: string;
            date: string;
        }>
    >({
        path: `${AGENT_API}/deal-contributions`,
        params,
    });

/** Agent's current enrollment data */
export const useMyEnrollment = () =>
    useApiQuery<{ data: MyEnrollmentData }>({
        path: `${AGENT_API}/my-enrollment`,
    });

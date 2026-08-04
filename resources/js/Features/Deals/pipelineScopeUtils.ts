export interface PipelineStageLike {
    id: number;
    lead_pipeline_id: number;
    priority: number;
}

export interface ScopeByStageMap {
    pipelineWide?: number[] | string[];
    byStage?: Record<string, number[] | string[]>;
}

/** UI field keys that differ from pipeline scope catalog keys. */
const FIELD_KEY_ALIASES: Record<string, string> = {
    email: "client_email",
};

function normalizeCategoryId(id: number | string): number {
    return Number(id);
}

function normalizeCategoryIds(
    ids: Array<number | string> | null | undefined,
): number[] {
    if (!ids?.length) {
        return [];
    }

    return Array.from(
        new Set(
            ids
                .map(normalizeCategoryId)
                .filter((id) => Number.isFinite(id)),
        ),
    );
}

function mergePipelineScopeIds(scope: ScopeByStageMap): number[] {
    const pipelineWide = normalizeCategoryIds(
        (scope.pipelineWide ?? []) as Array<number | string>,
    );
    const byStage = scope.byStage ?? {};
    const allStageIds = getStageAssignedCategoryIds(byStage);

    return mergeCategoriesWithStagePrecedence(
        pipelineWide,
        byStage,
        allStageIds,
    );
}

function mergePipelineScopeKeys(scope: ScopeByStageMap): string[] {
    const pipelineWide = (scope.pipelineWide ?? []) as string[];
    const byStage = scope.byStage ?? {};
    const allStageKeys = getStageAssignedFieldKeys(byStage);

    return mergeFieldKeysWithStagePrecedence(
        pipelineWide,
        byStage,
        allStageKeys,
    );
}

function normalizePipelineId(id: number | string | undefined | null): number | null {
    if (id == null) {
        return null;
    }

    const normalized = Number(id);
    return Number.isFinite(normalized) ? normalized : null;
}

/**
 * Pipeline-level "Show none" override — set in Pipeline Settings, it hides
 * every custom field category for the pipeline regardless of any pipeline-wide
 * or per-stage category_scopes rows. Must be checked before any scope-map
 * resolution so it wins outright even when scopes are still configured.
 */
function pipelineHidesAllCategories(
    hideAllCategoriesPipelineIds: Array<number | string> | undefined,
    pipelineId: number | string | null | undefined,
): boolean {
    if (!hideAllCategoriesPipelineIds?.length || pipelineId == null) {
        return false;
    }

    const normalized = normalizePipelineId(pipelineId);
    return hideAllCategoriesPipelineIds.some(
        (id) => normalizePipelineId(id) === normalized,
    );
}

function normalizeStageId(id: number | string | undefined | null): number | null {
    return normalizePipelineId(id);
}

/**
 * Stages for a pipeline in pipeline order (priority asc, then id asc).
 */
export function getOrderedPipelineStages(
    stages: PipelineStageLike[] | undefined,
    pipelineId?: number | string | null,
): PipelineStageLike[] {
    const normalizedPipelineId = normalizePipelineId(pipelineId);

    if (!stages?.length || normalizedPipelineId == null) {
        return [];
    }

    return stages
        .filter(
            (stage) =>
                normalizePipelineId(stage.lead_pipeline_id) ===
                normalizedPipelineId,
        )
        .sort(
            (a, b) =>
                a.priority - b.priority || Number(a.id) - Number(b.id),
        );
}

function lookupStageScopeValues(
    byStage: Record<string, number[] | string[] | undefined>,
    stageId: number,
): Array<number | string> {
    return byStage[String(stageId)] ?? [];
}

/** Category IDs assigned to any stage — these override pipeline-wide assignments. */
function getStageAssignedCategoryIds(
    byStage: Record<string, number[] | string[] | undefined>,
): number[] {
    return normalizeCategoryIds(
        Object.values(byStage).flat() as Array<number | string>,
    );
}

function mergeCategoriesWithStagePrecedence(
    pipelineWide: number[],
    byStage: Record<string, number[] | string[] | undefined>,
    cumulativeStageIds: number[],
): number[] {
    const stageAssignedSet = new Set(getStageAssignedCategoryIds(byStage));
    const effectivePipelineWide = pipelineWide.filter(
        (id) => !stageAssignedSet.has(normalizeCategoryId(id)),
    );

    return Array.from(
        new Set([...effectivePipelineWide, ...cumulativeStageIds]),
    );
}

/** Field keys assigned to any stage — these override pipeline-wide assignments. */
function getStageAssignedFieldKeys(
    byStage: Record<string, number[] | string[] | undefined>,
): string[] {
    return Array.from(
        new Set(
            Object.values(byStage)
                .flat()
                .map(String),
        ),
    );
}

function mergeFieldKeysWithStagePrecedence(
    pipelineWide: string[],
    byStage: Record<string, number[] | string[] | undefined>,
    cumulativeStageKeys: string[],
): string[] {
    const stageAssignedSet = new Set(getStageAssignedFieldKeys(byStage));
    const effectivePipelineWide = pipelineWide.filter(
        (key) => !stageAssignedSet.has(key),
    );

    return Array.from(
        new Set([...effectivePipelineWide, ...cumulativeStageKeys]),
    );
}

function resolveCumulativeStageCategoryIds(
    byStage: Record<string, number[] | string[] | undefined>,
    stageIds: number[],
): number[] {
    return normalizeCategoryIds(
        stageIds.flatMap((sid) => lookupStageScopeValues(byStage, sid)),
    );
}

function resolveCumulativeStageFieldKeys(
    byStage: Record<string, number[] | string[] | undefined>,
    stageIds: number[],
): string[] {
    return stageIds.flatMap((sid) => {
        const values = lookupStageScopeValues(byStage, sid);
        return values.map(String);
    });
}

/**
 * When the current stage has scoped categories, those (plus earlier stages) win
 * and pipeline-wide categories are suppressed for this view.
 */
function resolveScopedCategoryIdsWithCurrentStagePrecedence(
    pipelineWide: number[],
    byStage: Record<string, number[] | string[] | undefined>,
    stageIdsToInclude: number[],
    currentStageId: number | null,
): number[] {
    const cumulativeStageIds = resolveCumulativeStageCategoryIds(
        byStage,
        stageIdsToInclude,
    );

    if (currentStageId != null) {
        const currentStageCategoryIds = normalizeCategoryIds(
            lookupStageScopeValues(byStage, currentStageId),
        );

        if (currentStageCategoryIds.length > 0) {
            const previousStageIds = stageIdsToInclude.filter(
                (id) => Number(id) !== Number(currentStageId),
            );
            const previousStageCategoryIds = resolveCumulativeStageCategoryIds(
                byStage,
                previousStageIds,
            );

            return Array.from(
                new Set([
                    ...previousStageCategoryIds,
                    ...currentStageCategoryIds,
                ]),
            );
        }
    }

    return mergeCategoriesWithStagePrecedence(
        pipelineWide,
        byStage,
        cumulativeStageIds,
    );
}

function resolveScopedFieldKeysWithCurrentStagePrecedence(
    pipelineWide: string[],
    byStage: Record<string, number[] | string[] | undefined>,
    stageIdsToInclude: number[],
    currentStageId: number | null,
): string[] {
    const cumulativeStageKeys = resolveCumulativeStageFieldKeys(
        byStage,
        stageIdsToInclude,
    );

    if (currentStageId != null) {
        const currentStageFieldKeys = resolveCumulativeStageFieldKeys(byStage, [
            currentStageId,
        ]);

        if (currentStageFieldKeys.length > 0) {
            const previousStageIds = stageIdsToInclude.filter(
                (id) => Number(id) !== Number(currentStageId),
            );
            const previousStageFieldKeys = resolveCumulativeStageFieldKeys(
                byStage,
                previousStageIds,
            );

            return Array.from(
                new Set([...previousStageFieldKeys, ...currentStageFieldKeys]),
            );
        }
    }

    return mergeFieldKeysWithStagePrecedence(
        pipelineWide,
        byStage,
        cumulativeStageKeys,
    );
}

/**
 * Stage IDs from the start of the pipeline through the current stage (inclusive),
 * based on position in the ordered stage list — not raw priority values (avoids
 * same-priority stages leaking future scopes onto earlier stages).
 */
export function getStageIdsUpToAndIncluding(
    stages: PipelineStageLike[] | undefined,
    pipelineId?: number | string | null,
    stageId?: number | string | null,
): number[] {
    const normalizedStageId = normalizeStageId(stageId);

    if (normalizedStageId == null) {
        return [];
    }

    const pipelineStages = getOrderedPipelineStages(stages, pipelineId);

    if (!pipelineStages.length) {
        return [normalizedStageId];
    }

    const currentIndex = pipelineStages.findIndex(
        (stage) => Number(stage.id) === normalizedStageId,
    );

    if (currentIndex === -1) {
        return [normalizedStageId];
    }

    return pipelineStages
        .slice(0, currentIndex + 1)
        .map((stage) => Number(stage.id));
}

/**
 * Resolve visible custom field category IDs for a pipeline + stage context.
 * Includes pipeline-wide categories when the current stage has none assigned;
 * otherwise shows categories from the current stage and all previous stages.
 * Stage-assigned categories take precedence over pipeline-wide assignments.
 * Returns null when no scopes are configured (show all — backward compatible).
 */
export function resolveScopedCategoryIds(
    scopeMap: Record<string, ScopeByStageMap>,
    pipelineId?: number,
    stageId?: number,
    stages?: PipelineStageLike[],
): number[] | null {
    if (pipelineId == null) {
        return null;
    }

    const key = String(pipelineId);
    const scope = scopeMap[key];

    if (!scope) {
        return null;
    }

    const pipelineWide = normalizeCategoryIds(
        (scope.pipelineWide ?? []) as Array<number | string>,
    );
    const byStage = scope.byStage ?? {};
    const hasAnyScopes =
        pipelineWide.length > 0 || Object.keys(byStage).length > 0;

    if (!hasAnyScopes) {
        return null;
    }

    const stageIdsToInclude = getStageIdsUpToAndIncluding(
        stages,
        pipelineId,
        stageId,
    );

    return resolveScopedCategoryIdsWithCurrentStagePrecedence(
        pipelineWide,
        byStage,
        stageIdsToInclude,
        normalizeStageId(stageId),
    );
}

/**
 * All category IDs configured for a pipeline (every stage + pipeline-wide).
 * Returns null when the pipeline has no scope configuration.
 */
export function resolveAllPipelineCategoryIds(
    scopeMap: Record<string, ScopeByStageMap>,
    pipelineId?: number,
): number[] | null {
    if (pipelineId == null) {
        return null;
    }

    const scope = scopeMap[String(pipelineId)];

    if (!scope) {
        return null;
    }

    const merged = mergePipelineScopeIds(scope);

    if (merged.length === 0) {
        return null;
    }

    return merged;
}

/**
 * All field keys configured for a pipeline and model (every stage + pipeline-wide).
 */
export function resolveAllPipelineFieldKeys(
    scopeMap: Record<string, Record<string, ScopeByStageMap>>,
    model: string,
    pipelineId?: number,
): string[] | null {
    if (pipelineId == null) {
        return null;
    }

    const scope = scopeMap[String(pipelineId)]?.[model];

    if (!scope) {
        return pipelineHasFieldScopesForPipeline(scopeMap, pipelineId) ? [] : null;
    }

    const merged = mergePipelineScopeKeys(scope);

    if (merged.length === 0) {
        return pipelineHasFieldScopesForPipeline(scopeMap, pipelineId) ? [] : null;
    }

    return merged;
}

export function pipelineHasFieldScopesForPipeline(
    scopeMap: Record<string, Record<string, ScopeByStageMap>>,
    pipelineId?: number | string | null,
): boolean {
    if (pipelineId == null) {
        return false;
    }

    const pipelineScope = scopeMap[String(pipelineId)];

    if (!pipelineScope) {
        return false;
    }

    return Object.values(pipelineScope).some((scope) => {
        const pipelineWide = scope.pipelineWide ?? [];
        const byStage = scope.byStage ?? {};

        return pipelineWide.length > 0 || Object.keys(byStage).length > 0;
    });
}

/**
 * Resolve visible field keys for a model (cumulative through current stage).
 * Returns null when no scopes configured (show all).
 */
export function resolveScopedFieldKeys(
    scopeMap: Record<
        string,
        Record<string, ScopeByStageMap>
    >,
    model: string,
    pipelineId?: number,
    stageId?: number,
    stages?: PipelineStageLike[],
): string[] | null {
    if (pipelineId == null) {
        return null;
    }

    const pipelineScope = scopeMap[String(pipelineId)]?.[model];

    if (!pipelineScope) {
        return pipelineHasFieldScopesForPipeline(scopeMap, pipelineId) ? [] : null;
    }

    const pipelineWide = (pipelineScope.pipelineWide ?? []) as string[];
    const byStage = pipelineScope.byStage ?? {};
    const hasAnyScopes =
        pipelineWide.length > 0 || Object.keys(byStage).length > 0;

    if (!hasAnyScopes) {
        return null;
    }

    const stageIdsToInclude = getStageIdsUpToAndIncluding(
        stages,
        pipelineId,
        stageId,
    );

    return resolveScopedFieldKeysWithCurrentStagePrecedence(
        pipelineWide,
        byStage,
        stageIdsToInclude,
        normalizeStageId(stageId),
    );
}

export function filterCategoriesByScope<T extends { id: number }>(
    allCategories: T[],
    scopeMap: Record<string, ScopeByStageMap>,
    pipelineId?: number,
    stageId?: number,
    stages?: PipelineStageLike[],
    fallbackIds?: number[] | null,
    hideAllCategoriesPipelineIds?: Array<number | string>,
): T[] {
    if (pipelineHidesAllCategories(hideAllCategoriesPipelineIds, pipelineId)) {
        return [];
    }

    const clientIds = resolveScopedCategoryIds(
        scopeMap,
        pipelineId,
        stageId,
        stages,
    );

    const pipelineScope =
        pipelineId != null ? scopeMap[String(pipelineId)] : undefined;
    const hasPipelineConfig =
        pipelineScope != null &&
        ((pipelineScope.pipelineWide?.length ?? 0) > 0 ||
            Object.keys(pipelineScope.byStage ?? {}).length > 0);

    const allowedIds =
        clientIds ??
        (hasPipelineConfig ? (fallbackIds ?? null) : null);

    if (allowedIds === null) {
        return allCategories;
    }

    if (allowedIds.length === 0) {
        return [];
    }

    const allowedSet = new Set<number>(normalizeCategoryIds(allowedIds));
    return allCategories.filter((c) =>
        allowedSet.has(normalizeCategoryId(c.id)),
    );
}

/**
 * Categories visible in "all fields" mode: every category scoped to the pipeline,
 * or all categories when no pipeline scopes exist.
 */
export function filterCategoriesForAllFieldsView<T extends { id: number }>(
    allCategories: T[],
    scopeMap: Record<string, ScopeByStageMap>,
    pipelineId?: number,
    fallbackIds?: number[] | null,
    hideAllCategoriesPipelineIds?: Array<number | string>,
): T[] {
    if (pipelineHidesAllCategories(hideAllCategoriesPipelineIds, pipelineId)) {
        return [];
    }

    const clientIds = resolveAllPipelineCategoryIds(scopeMap, pipelineId);

    const pipelineScope =
        pipelineId != null ? scopeMap[String(pipelineId)] : undefined;
    const hasPipelineConfig =
        pipelineScope != null &&
        ((pipelineScope.pipelineWide?.length ?? 0) > 0 ||
            Object.keys(pipelineScope.byStage ?? {}).length > 0);

    const allPipelineIds =
        clientIds ?? (hasPipelineConfig ? (fallbackIds ?? null) : null);

    if (allPipelineIds === null) {
        return allCategories;
    }

    const allowedSet = new Set<number>(normalizeCategoryIds(allPipelineIds));
    return allCategories.filter((c) =>
        allowedSet.has(normalizeCategoryId(c.id)),
    );
}

/**
 * Check if a native/hibarr/custom field key is visible given scoped field keys.
 * null visibleKeys = show all.
 */
export function isFieldVisible(
    visibleKeys: string[] | null | undefined,
    fieldKey: string,
): boolean {
    if (visibleKeys == null) {
        return true;
    }

    const candidates = new Set<string>([fieldKey]);
    const alias = FIELD_KEY_ALIASES[fieldKey];
    if (alias) {
        candidates.add(alias);
    }

    for (const candidate of candidates) {
        const matches = visibleKeys.some(
            (key) =>
                key === candidate ||
                key.endsWith(":" + candidate) ||
                key.endsWith(":custom_field_" + candidate) ||
                key === "native_field:" + candidate ||
                key === "hibarr_field:" + candidate ||
                key === "custom_field:" + candidate,
        );

        if (matches) {
            return true;
        }
    }

    return false;
}

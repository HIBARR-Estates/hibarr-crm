import React from "react";
import BulkDeleteDeals from "./BulkDeleteDeals";
import BulkUpdateModal from "@/Features/BulkActions/BulkUpdateModal";
import BulkExportModal from "@/Features/BulkActions/BulkExportModal";
import BulkActionBar from "@/Components/Redesign/primitives/BulkActionBar";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { fmt } from "@/Features/Filters/controls";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { usePermission } from "@/lib/permissionUtils";
import type { BulkTarget } from "@/Features/BulkActions/bulkTarget";
import type { BulkActionSummaryData } from "@/Features/BulkActions/BulkActionSummary";
import {
    createDealBulkUpdateFields,
    type DealBulkUpdateOptionsInput,
} from "./dealBulkUpdateConfig";
import { DEAL_EXPORT_FIELDS } from "./dealExportFieldConfig";

type TDealBulkAction = "bulk_update" | "delete" | "export";

interface Props {
    selectedEntityIds?: number[];
    /** Total deals matching current filters (from paginator). */
    matchingTotal: number;
    /** True when selection targets the full filtered set. */
    selectAllMatching: boolean;
    onSelectAllMatching: () => void;
    clearSelected: () => void;
    updateOptions?: DealBulkUpdateOptionsInput;
    /** Receipt for the list view once an action lands. */
    onCompleted?: (summary: BulkActionSummaryData) => void;
    optionsLoading?: boolean;
}

/**
 * Deal list bulk toolbar — same navy bar the leads list uses.
 * Appears once a row selection starts.
 */
const BulkDealActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    matchingTotal,
    selectAllMatching,
    onSelectAllMatching,
    clearSelected,
    updateOptions = {},
    onCompleted,
    optionsLoading = false,
}) => {
    const { td } = useTd();
    const { hasPermission } = usePermission();

    const canEdit = hasPermission("edit_deals");
    const canDelete = hasPermission("delete_deals");
    const canExport = useIsAdminRole();

    const [action, setAction] = React.useState<TDealBulkAction | null>(null);

    const updateFields = React.useMemo(
        () => createDealBulkUpdateFields(updateOptions),
        [updateOptions],
    );

    const selectedCount = selectAllMatching
        ? matchingTotal
        : selectedEntityIds.length;

    const target: BulkTarget = selectAllMatching
        ? { mode: "all_matching", count: matchingTotal }
        : {
              mode: "ids",
              ids: selectedEntityIds,
              count: selectedEntityIds.length,
          };

    // Only after a real selection starts, and only if more deals match filters.
    const showSelectAllMatching =
        !selectAllMatching &&
        selectedEntityIds.length > 0 &&
        matchingTotal > selectedEntityIds.length;

    const availableActions = React.useMemo(() => {
        const items: Array<{ key: TDealBulkAction; label: string }> = [];
        if (canEdit) {
            items.push({
                key: "bulk_update",
                label: td("Bulk update", { source: "en" }),
            });
        }
        if (canDelete) {
            items.push({ key: "delete", label: td("Delete", { source: "en" }) });
        }
        if (canExport) {
            items.push({ key: "export", label: td("Export", { source: "en" }) });
        }
        return items;
    }, [canEdit, canDelete, canExport, td]);

    const onClose = (operationSucceeded?: boolean) => {
        setAction(null);
        if (operationSucceeded) clearSelected();
    };

    if (selectedCount === 0) {
        return null;
    }

    return (
        <>
            {canEdit ? (
                <BulkUpdateModal
                    open={action === "bulk_update"}
                    onClose={onClose}
                    target={target}
                    fields={updateFields}
                    endpoint={route("deals.apply_quick_action")}
                    entityLabel="deal"
                    reloadOnly="deals"
                    onCompleted={onCompleted}
                    actionNote={td("Locked deals are skipped.", {
                        source: "en",
                    })}
                    optionsLoading={optionsLoading}
                />
            ) : null}

            {canDelete ? (
                <BulkDeleteDeals
                    target={target}
                    onClose={onClose}
                    open={action === "delete"}
                />
            ) : null}

            {canExport ? (
                <BulkExportModal
                    target={target}
                    onClose={onClose}
                    open={action === "export"}
                    fields={DEAL_EXPORT_FIELDS}
                    endpoint={route("deals.export")}
                    entityLabel="deals"
                />
            ) : null}

            <BulkActionBar
                count={selectedCount}
                onClear={clearSelected}
                clearLabel={td("Clear", { source: "en" })}
                selectedLabel={`${fmt(selectedCount)} ${
                    selectAllMatching
                        ? td("matching selected", { source: "en" })
                        : td("selected", { source: "en" })
                }`}
                style={{ padding: "14px 18px", gap: 16 }}
                actionsGap={10}
            >
                {showSelectAllMatching ? (
                    <button
                        type="button"
                        className="dr-btn"
                        style={{ background: T.WHITE, color: T.NAVY }}
                        onClick={onSelectAllMatching}
                    >
                        {td("Select all", { source: "en" })} {fmt(matchingTotal)}
                    </button>
                ) : null}

                {selectAllMatching ? (
                    <span
                        className="inline-flex items-center rounded-md text-sm font-medium whitespace-nowrap"
                        style={{
                            padding: "9px 14px",
                            background: T.WHITE,
                            color: T.NAVY,
                        }}
                    >
                        {td("All matching filters", { source: "en" })}
                    </span>
                ) : null}

                {availableActions.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className="dr-btn"
                        style={
                            item.key === "bulk_update"
                                ? { background: T.BLUE, color: T.WHITE }
                                : item.key === "delete"
                                  ? { background: T.RED, color: T.WHITE }
                                  : { background: T.WHITE, color: T.NAVY }
                        }
                        onClick={() => setAction(item.key)}
                    >
                        {item.label}
                    </button>
                ))}
            </BulkActionBar>
        </>
    );
};

export default BulkDealActionSelector;

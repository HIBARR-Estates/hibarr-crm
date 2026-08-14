import React, { useMemo } from "react";
import BulkDeleteLeads from "./BulkDeleteLeads";
import BulkExportLeads from "./BulkExportLeads";
import BulkMergeLeads from "../Merge/BulkMergeLeads";
import BulkUpdateModal from "./BulkUpdateModal";
import useLeadMergeAccess from "../Merge/useLeadMergeAccess";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { usePermission } from "@/lib/permissionUtils";
import { fmt } from "@/Features/Leads/Filters/controls";
import BulkActionBar from "@/Components/Redesign/primitives/BulkActionBar";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { BulkUpdateOptionsInput } from "./bulkUpdateConfig";
import type { LeadBulkTarget } from "./bulkTarget";

type TLeadBulkAction = "bulk_update" | "delete" | "merge" | "export";

interface Props {
    selectedEntityIds?: number[];
    /** Total leads matching current filters (from paginator). */
    matchingTotal: number;
    /** True when selection targets the full filtered set. */
    selectAllMatching: boolean;
    onSelectAllMatching: () => void;
    clearSelected: () => void;
    updateOptions?: BulkUpdateOptionsInput;
    optionsLoading?: boolean;
}

/**
 * Lead list bulk toolbar. Appears once a row selection starts.
 * "Select all matching" lives inside this card as a real button — not a
 * free-floating header control.
 */
const BulkLeadActionSelector: React.FC<Props> = ({
    selectedEntityIds = [],
    matchingTotal,
    selectAllMatching,
    onSelectAllMatching,
    clearSelected,
    updateOptions = {},
    optionsLoading = false,
}) => {
    const { td } = useTd();
    const { hasPermission } = usePermission();

    const canEdit = hasPermission("edit_lead");
    const canDelete = hasPermission("delete_lead");
    const canExport = useIsAdminRole();
    const canMergeLeads = useLeadMergeAccess();
    const canMerge =
        canMergeLeads &&
        !selectAllMatching &&
        selectedEntityIds.length === 2;

    const [action, setAction] = React.useState<TLeadBulkAction | null>(null);

    const selectedCount = selectAllMatching
        ? matchingTotal
        : selectedEntityIds.length;

    const target: LeadBulkTarget = selectAllMatching
        ? { mode: "all_matching", count: matchingTotal }
        : {
              mode: "ids",
              ids: selectedEntityIds,
              count: selectedEntityIds.length,
          };

    // Only after a real selection starts, and only if more leads match filters.
    const showSelectAllMatching =
        !selectAllMatching &&
        selectedEntityIds.length > 0 &&
        matchingTotal > selectedEntityIds.length;

    const availableActions = useMemo(() => {
        const items: Array<{ key: TLeadBulkAction; label: string }> = [];
        if (canEdit) {
            items.push({
                key: "bulk_update",
                label: td("Bulk update", { source: "en" }),
            });
        }
        if (canDelete) {
            items.push({
                key: "delete",
                label: td("Delete", { source: "en" }),
            });
        }
        if (canMerge) {
            items.push({
                key: "merge",
                label: td("Merge", { source: "en" }),
            });
        }
        if (canExport) {
            items.push({
                key: "export",
                label: td("Export", { source: "en" }),
            });
        }
        return items;
    }, [canEdit, canDelete, canMerge, canExport, td]);

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
                    options={updateOptions}
                    optionsLoading={optionsLoading}
                />
            ) : null}

            {canDelete ? (
                <BulkDeleteLeads
                    target={target}
                    onClose={onClose}
                    open={action === "delete"}
                />
            ) : null}

            {canMerge ? (
                <BulkMergeLeads
                    ids={selectedEntityIds}
                    onClose={onClose}
                    open={action === "merge"}
                />
            ) : null}

            {canExport ? (
                <BulkExportLeads
                    target={target}
                    onClose={onClose}
                    open={action === "export"}
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
                        style={{ padding: "9px 14px", background: T.WHITE, color: T.NAVY }}
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

export default BulkLeadActionSelector;

import { Button } from "antd";
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

            <div className="flex items-center gap-3 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold tabular-nums">
                        {fmt(selectedCount)}
                    </span>
                    <span className="text-sm text-blue-900 whitespace-nowrap">
                        {selectAllMatching
                            ? td("matching selected", { source: "en" })
                            : td("selected", { source: "en" })}
                    </span>
                </div>

                <div className="w-px h-5 bg-blue-200 shrink-0" aria-hidden />

                <div className="flex items-center gap-1.5 flex-wrap">
                    {showSelectAllMatching ? (
                        <Button
                            size="small"
                            type="default"
                            className="!border-blue-300 !text-blue-800 !bg-white hover:!border-blue-400 hover:!text-blue-900 font-medium"
                            onClick={onSelectAllMatching}
                        >
                            {td("Select all", { source: "en" })}{" "}
                            {fmt(matchingTotal)}
                        </Button>
                    ) : null}

                    {selectAllMatching ? (
                        <span className="inline-flex items-center h-6 px-2 rounded-md border border-blue-300 bg-white text-xs font-medium text-blue-800 whitespace-nowrap">
                            {td("All matching filters", { source: "en" })}
                        </span>
                    ) : null}

                    {availableActions.map((item) => (
                        <Button
                            key={item.key}
                            type={
                                item.key === "bulk_update"
                                    ? "primary"
                                    : "default"
                            }
                            danger={item.key === "delete"}
                            size="small"
                            onClick={() => setAction(item.key)}
                        >
                            {item.label}
                        </Button>
                    ))}

                    <Button size="small" type="text" onClick={clearSelected}>
                        {td("Clear", { source: "en" })}
                    </Button>
                </div>
            </div>
        </>
    );
};

export default BulkLeadActionSelector;

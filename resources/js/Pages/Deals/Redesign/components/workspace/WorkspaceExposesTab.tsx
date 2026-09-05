import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import type { PageProps } from "@/Components/DashboardLayout";
import type { Deal } from "@/Types/api/deals";
import type { AppPermission } from "@/Types/permission";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";
import { canManageDealExposes } from "../../adapters/dealExposeAdapter";
import useDealExposes from "../../hooks/useDealExposes";
import ExposesPanel from "./ExposesPanel";
import AddExposeModal from "./AddExposeModal";
import DealConfirmDialog from "../primitives/DealConfirmDialog";

interface WorkspaceExposesTabProps {
    deal: Deal;
    canEdit: boolean;
    onCountChange?: (count: number) => void;
}

/**
 * Deal-scoped Exposes tab: one flat list of the exposés on this deal, with
 * both add paths from the design.
 */
export default function WorkspaceExposesTab({
    deal,
    canEdit,
    onCountChange,
}: WorkspaceExposesTabProps) {
    const { t } = useTranslation();
    const { props: pageProps } = usePage<PageProps>();
    const permissions = pageProps.auth?.permissions as AppPermission | undefined;
    const [addSource, setAddSource] = useState<"linked" | "manual" | null>(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
    const {
        exposes,
        summary,
        loading,
        saving,
        isUploadingFile,
        uploadProgress,
        uploadBytesLoaded,
        uploadBytesTotal,
        loadFailed,
        reload,
        setStatus,
        updateExpose,
        addExpose,
        removeExpose,
        cancelUpload,
    } = useDealExposes({ type: "deal", dealId: deal.id });

    useEffect(() => {
        onCountChange?.(exposes.length);
    }, [exposes.length, onCountChange]);

    const editable =
        canEdit &&
        !isDealEffectivelyLocked(deal) &&
        canManageDealExposes(permissions);

    return (
        <>
            <ExposesPanel
                exposes={exposes}
                summary={summary}
                loading={loading}
                loadFailed={loadFailed}
                grouping="flat"
                currencySymbol={deal.currency?.currency_symbol || "£"}
                subtitle={t("pages.deals.workspace.exposes.subtitle_deal")}
                canEdit={editable}
                onAdd={(source) => setAddSource(source)}
                onStatusChange={setStatus}
                onUpdate={editable ? updateExpose : undefined}
                onRemove={editable ? (id) => setConfirmRemoveId(id) : undefined}
                onRetry={reload}
            />
            {addSource && (
                <AddExposeModal
                    open
                    source={addSource}
                    dealId={deal.id}
                    currencySymbol={deal.currency?.currency_symbol || "£"}
                    saving={saving}
                    isUploadingFile={isUploadingFile}
                    uploadProgress={uploadProgress}
                    uploadBytesLoaded={uploadBytesLoaded}
                    uploadBytesTotal={uploadBytesTotal}
                    onCancelUpload={cancelUpload}
                    onSubmit={async (input) => {
                        const failure = await addExpose(input);
                        if (failure === null) setAddSource(null);
                        return failure;
                    }}
                    onClose={() => setAddSource(null)}
                />
            )}
            <DealConfirmDialog
                open={confirmRemoveId != null}
                title={t("pages.deals.common.delete")}
                message={t(
                    "pages.deals.workspace.exposes.delete_confirm_message",
                )}
                confirmLabel={t("pages.deals.common.delete")}
                danger
                onConfirm={() => {
                    if (confirmRemoveId == null) return;
                    void removeExpose(confirmRemoveId);
                    setConfirmRemoveId(null);
                }}
                onCancel={() => setConfirmRemoveId(null)}
            />
        </>
    );
}

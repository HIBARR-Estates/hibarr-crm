import { useEffect } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import type { PageProps } from "@/Components/DashboardLayout";
import type { AppPermission } from "@/Types/permission";
import { canManageDealExposes } from "@/Pages/Deals/Redesign/adapters/dealExposeAdapter";
import useDealExposes from "@/Pages/Deals/Redesign/hooks/useDealExposes";
import ExposesPanel from "@/Pages/Deals/Redesign/components/workspace/ExposesPanel";

interface ExposesTabProps {
    leadId: number;
    currencySymbol: string;
    onCountChange?: (count: number) => void;
}

/**
 * Lead rollup of every exposé across the lead's deals, grouped by deal.
 *
 * Read-only by design: an exposé belongs to a deal, so adding one happens on
 * that deal's own Exposes tab. Status can still be moved from here, which is
 * where an agent reviewing the whole lead actually wants it.
 */
export default function ExposesTab({
    leadId,
    currencySymbol,
    onCountChange,
}: ExposesTabProps) {
    const { t } = useTranslation();
    const { props: pageProps } = usePage<PageProps>();
    const permissions = pageProps.auth?.permissions as AppPermission | undefined;
    const canEdit = canManageDealExposes(permissions);
    const { exposes, summary, loading, loadFailed, reload, setStatus } =
        useDealExposes({ type: "lead", leadId });

    useEffect(() => {
        onCountChange?.(exposes.length);
    }, [exposes.length, onCountChange]);

    return (
        <ExposesPanel
            exposes={exposes}
            summary={summary}
            loading={loading}
            loadFailed={loadFailed}
            grouping="by-deal"
            currencySymbol={currencySymbol}
            subtitle={t("pages.deals.workspace.exposes.subtitle_lead")}
            canEdit={canEdit}
            onStatusChange={setStatus}
            onRetry={reload}
        />
    );
}

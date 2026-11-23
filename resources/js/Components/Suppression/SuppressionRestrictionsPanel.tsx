import { useState } from "react";
import { Alert } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import BlockSuppressionModal from "./BlockSuppressionModal";
import LiftSuppressionModal from "./LiftSuppressionModal";
import { isRestrictedSuppression } from "./suppressionPolicy";
import type {
    BlockedChannelSummary,
    SuppressionContactTarget,
    SuppressionEntityType,
    SuppressionPermissions,
    SuppressionRestriction,
} from "./types";

interface SuppressionRestrictionsPanelProps {
    entityType: SuppressionEntityType;
    entityId: number;
    targets: SuppressionContactTarget[];
    restrictions: SuppressionRestriction[];
    blockedChannels: BlockedChannelSummary[];
    unavailable: boolean;
    loading: boolean;
    permissions: SuppressionPermissions;
    onChanged: () => Promise<void> | void;
}

export default function SuppressionRestrictionsPanel({
    entityType,
    entityId,
    targets,
    restrictions,
    blockedChannels,
    unavailable,
    loading,
    permissions,
    onChanged,
}: SuppressionRestrictionsPanelProps) {
    const { t } = useTranslation();
    const { formatDateTime } = useUserDateTime();
    const [blockModalOpen, setBlockModalOpen] = useState(false);
    const [liftingEntry, setLiftingEntry] =
        useState<SuppressionRestriction | null>(null);

    const hasAnyBlocks =
        restrictions.length > 0 || blockedChannels.length > 0;

    if (
        !unavailable &&
        !hasAnyBlocks &&
        !permissions.canBlock &&
        !permissions.canViewDetails
    ) {
        return null;
    }

    return (
        <div
            className="mt-3 rounded-lg border border-dr-border bg-white p-3"
            data-testid="suppression-restrictions-panel"
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-dr-text-muted">
                    {t("pages.suppressions.panel.title")}
                </span>
                {permissions.canBlock ? (
                    <button
                        type="button"
                        onClick={() => setBlockModalOpen(true)}
                        className="cursor-pointer rounded border border-dr-border bg-dr-surface-2 px-2 py-0.5 text-xs font-medium text-dr-text hover:bg-slate-200"
                    >
                        {t("pages.suppressions.panel.block_button")}
                    </button>
                ) : null}
            </div>

            {unavailable ? (
                <Alert
                    type="warning"
                    showIcon
                    message={t("pages.suppressions.panel.unavailable")}
                    className="mb-2 text-xs"
                />
            ) : loading ? (
                <p className="m-0 text-xs text-dr-text-muted">
                    {t("pages.suppressions.panel.loading")}
                </p>
            ) : !permissions.canViewDetails ? (
                hasAnyBlocks ? (
                    <Alert
                        type="warning"
                        showIcon
                        message={t(
                            "pages.suppressions.panel.sending_unavailable_generic",
                        )}
                        className="text-xs"
                    />
                ) : (
                    <p className="m-0 text-xs text-dr-text-muted">
                        {t("pages.suppressions.panel.no_blocks")}
                    </p>
                )
            ) : restrictions.length === 0 ? (
                <p className="m-0 text-xs text-dr-text-muted">
                    {t("pages.suppressions.panel.no_blocks")}
                </p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {restrictions.map((entry) => {
                        const restricted = isRestrictedSuppression(entry);
                        const canLiftThis =
                            permissions.canLift &&
                            (!restricted || permissions.canLiftRestricted);
                        const contactLabel =
                            entry.email ||
                            entry.phone ||
                            t("pages.suppressions.panel.record_scope");

                        return (
                            <li
                                key={entry.uuid}
                                className="rounded border border-amber-200 bg-amber-50/70 p-2 text-xs"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-amber-950">
                                            {t(
                                                `pages.suppressions.channels.${entry.channel}`,
                                            )}{" "}
                                            ×{" "}
                                            {t(
                                                `pages.suppressions.scopes.${entry.scope}`,
                                            )}
                                        </div>
                                        <div className="truncate text-amber-900">
                                            {contactLabel}
                                        </div>
                                    </div>
                                    {canLiftThis ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setLiftingEntry(entry)
                                            }
                                            className="shrink-0 cursor-pointer rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-950 hover:bg-amber-100"
                                        >
                                            {t(
                                                "pages.suppressions.panel.lift_button",
                                            )}
                                        </button>
                                    ) : null}
                                </div>

                                <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-amber-900/90">
                                    <div>
                                        {t("pages.suppressions.panel.reason")}:{" "}
                                        {entry.reason}
                                    </div>
                                    <div>
                                        {t("pages.suppressions.panel.source")}:{" "}
                                        {entry.source}
                                        {entry.author
                                            ? ` · ${entry.author}`
                                            : ""}
                                    </div>
                                    <div>
                                        {t("pages.suppressions.panel.date")}:{" "}
                                        {formatDateTime(entry.createdAt)}
                                    </div>
                                    {entry.applyToFutureDetails ? (
                                        <div className="font-medium">
                                            {t(
                                                "pages.suppressions.panel.applies_to_future",
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <BlockSuppressionModal
                open={blockModalOpen}
                onClose={() => setBlockModalOpen(false)}
                entityType={entityType}
                entityId={entityId}
                targets={targets}
                onBlocked={onChanged}
            />

            <LiftSuppressionModal
                open={liftingEntry !== null}
                entry={liftingEntry}
                entityType={entityType}
                entityId={entityId}
                onClose={() => setLiftingEntry(null)}
                onLifted={onChanged}
            />
        </div>
    );
}

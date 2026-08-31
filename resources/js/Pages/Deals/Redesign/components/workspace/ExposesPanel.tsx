import { useEffect, useMemo, useRef, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { DealExpose, DealExposeStatus, DealExposeSummary } from "@/Types/api/dealExposes";
import {
    EXPOSE_STATUS_ORDER,
    exposeStatusMeta,
    downloadDealExpose,
    formatExposeAmount,
    formatExposeDate,
    groupExposes,
    parseExposeAmount,
} from "../../adapters/dealExposeAdapter";
import DealIcon from "../primitives/DealIcon";
import DealMenuSelect from "../primitives/DealMenuSelect";
import DealEditableField from "../primitives/DealEditableField";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

export interface ExposeUpdatePatch {
    title?: string;
    amount?: number | null;
}

interface ExposesPanelProps {
    exposes: DealExpose[];
    summary: DealExposeSummary;
    loading: boolean;
    loadFailed: boolean;
    /** Deal view renders one flat list; lead view groups by deal. */
    grouping: "flat" | "by-deal";
    currencySymbol: string;
    /** Subtitle under the panel title — differs between deal and lead. */
    subtitle: string;
    canEdit: boolean;
    /** Omitted on the lead view, where adding is deal-scoped. */
    onAdd?: (source: "linked" | "manual") => void;
    /** Omitted when the user cannot remove exposes. */
    onRemove?: (id: number) => void;
    onStatusChange: (id: number, status: DealExposeStatus) => void;
    onUpdate?: (id: number, patch: ExposeUpdatePatch) => Promise<void>;
    onRetry: () => void;
}

function ExposesSkeleton() {
    return (
        <div role="status" className="flex flex-col gap-2.5">
            {[1, 2, 3].map((row) => (
                <div
                    key={row}
                    className="flex items-center gap-3.5 rounded-[10px] border p-[15px]"
                    style={{ borderColor: T.BORDER, background: T.WHITE }}
                >
                    <span className="dr-skeleton h-10 w-10 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                        <span className="dr-skeleton block h-4 w-48" />
                        <span className="dr-skeleton mt-2 block h-3.5 w-64" />
                    </div>
                    <span className="dr-skeleton h-8 w-28 rounded-full" />
                </div>
            ))}
        </div>
    );
}

/**
 * The Exposes surface from the design handoff, shared by the Deal and Lead
 * workspaces. Presentational only — every mutation is handed up, so the
 * owning tab decides what a status change or an addition does.
 */
export default function ExposesPanel({
    exposes,
    summary,
    loading,
    loadFailed,
    grouping,
    currencySymbol,
    subtitle,
    canEdit,
    onAdd,
    onRemove,
    onStatusChange,
    onUpdate,
    onRetry,
}: ExposesPanelProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [addOpen, setAddOpen] = useState(false);
    const addRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!addOpen) return undefined;
        const onDocClick = (event: MouseEvent) => {
            if (addRef.current?.contains(event.target as Node)) return;
            setAddOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setAddOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [addOpen]);

    const groups = useMemo(
        () => groupExposes(exposes, grouping),
        [exposes, grouping],
    );

    const statusOptions = useMemo(
        () =>
            EXPOSE_STATUS_ORDER.map((status) => {
                const meta = exposeStatusMeta(status);
                return {
                    value: status,
                    label: td(meta.label),
                    dot: meta.dot,
                };
            }),
        [td],
    );

    const summaryRow: Array<{ status: DealExposeStatus; count: number; label: string }> = [
        { status: "shown", count: summary.shown, label: "awaiting response" },
        { status: "accepted", count: summary.accepted, label: "accepted" },
        { status: "not_accepted", count: summary.not_accepted, label: "not accepted" },
        { status: "not_sent", count: summary.not_sent, label: "not sent" },
    ];

    return (
        <div>
            <div className="mb-4 flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        <DealIcon name="file-text" size={18} color={T.NAVY} />
                        <h2
                            className="m-0 text-base font-bold"
                            style={{ color: T.TEXT }}
                        >
                            {t("pages.deals.workspace.exposes.title")}
                        </h2>
                        <span
                            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1.5 text-xs font-semibold"
                            style={{
                                background: T.GRAY,
                                borderColor: T.BORDER,
                                color: T.TEXT_MUTED,
                            }}
                        >
                            {summary.total}
                        </span>
                    </div>
                    <div
                        className="mt-[5px] text-[13px]"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {subtitle}
                    </div>
                </div>

                {onAdd && canEdit && (
                    <div ref={addRef} className="relative flex-none">
                        <button
                            type="button"
                            className="dr-btn dr-btn-primary"
                            aria-haspopup="menu"
                            aria-expanded={addOpen}
                            onClick={() => setAddOpen((open) => !open)}
                        >
                            <DealIcon name="plus" size={15} />
                            {t("pages.deals.workspace.exposes.add")}
                        </button>
                        {addOpen && (
                            <div
                                className="dr-menu absolute right-0 top-[calc(100%+6px)] z-30 w-[264px]"
                                role="menu"
                            >
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="dr-menu-item items-start text-left"
                                    onClick={() => {
                                        setAddOpen(false);
                                        onAdd("linked");
                                    }}
                                >
                                    <DealIcon
                                        name="external-link"
                                        size={18}
                                        color={T.BLUE}
                                    />
                                    <span className="block">
                                        <span
                                            className="block text-sm font-semibold"
                                            style={{ color: T.TEXT }}
                                        >
                                            {t("pages.deals.workspace.exposes.add_linked")}
                                        </span>
                                        <span
                                            className="mt-0.5 block text-xs"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            {t("pages.deals.workspace.exposes.add_linked_hint")}
                                        </span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="dr-menu-item items-start text-left"
                                    onClick={() => {
                                        setAddOpen(false);
                                        onAdd("manual");
                                    }}
                                >
                                    <DealIcon
                                        name="paperclip"
                                        size={18}
                                        color={T.NAVY}
                                    />
                                    <span className="block">
                                        <span
                                            className="block text-sm font-semibold"
                                            style={{ color: T.TEXT }}
                                        >
                                            {t("pages.deals.workspace.exposes.add_manual")}
                                        </span>
                                        <span
                                            className="mt-0.5 block text-xs"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            {t("pages.deals.workspace.exposes.add_manual_hint")}
                                        </span>
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {exposes.length > 0 && (
                <div
                    className="mb-3.5 flex flex-wrap items-center gap-4 rounded-lg border px-3.5 py-[11px]"
                    style={{
                        background: T.SURFACE_2,
                        borderColor: T.BORDER_SOFT,
                    }}
                >
                    {summaryRow.map((entry) => (
                        <div
                            key={entry.status}
                            className="flex items-center gap-2 text-[13px]"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            <span
                                aria-hidden="true"
                                className="h-2 w-2 rounded-full"
                                style={{
                                    background: exposeStatusMeta(entry.status).dot,
                                }}
                            />
                            {entry.count} {td(entry.label)}
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <ExposesSkeleton />
            ) : loadFailed ? (
                <div
                    role="alert"
                    className="rounded-[10px] border border-dashed px-3.5 py-6 text-center"
                    style={{ borderColor: T.BORDER, background: T.SURFACE_2 }}
                >
                    <div
                        className="mb-[3px] text-[13px] font-semibold"
                        style={{ color: T.TEXT }}
                    >
                        {t("pages.deals.workspace.exposes.load_failed")}
                    </div>
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm mt-2"
                        onClick={onRetry}
                    >
                        {t("pages.deals.workspace.exposes.retry")}
                    </button>
                </div>
            ) : exposes.length === 0 ? (
                <div
                    role="status"
                    className="rounded-[10px] border border-dashed px-3.5 py-6 text-center"
                    style={{ borderColor: T.BORDER, background: T.SURFACE_2 }}
                >
                    <div
                        aria-hidden="true"
                        className="mx-auto mb-2 flex h-[38px] w-[38px] items-center justify-center rounded-full"
                        style={{ background: T.BLUE_LIGHT }}
                    >
                        <DealIcon name="file-text" size={17} color={T.BLUE} />
                    </div>
                    <div
                        className="mb-[3px] text-[13px] font-semibold"
                        style={{ color: T.TEXT }}
                    >
                        {t("pages.deals.workspace.exposes.empty")}
                    </div>
                    <div
                        className="text-xs leading-relaxed"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {t("pages.deals.workspace.exposes.empty_hint")}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-[18px]">
                    {groups.map((group) => (
                        <div key={group.id}>
                            {group.showHeader && (
                                <div className="mb-2.5 flex items-center gap-2.5 px-0.5">
                                    <DealIcon
                                        name="briefcase"
                                        size={16}
                                        color={T.TEXT_MUTED}
                                    />
                                    <span
                                        className="text-[13px] font-bold"
                                        style={{ color: T.NAVY }}
                                    >
                                        {group.label}
                                    </span>
                                    <span
                                        className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold"
                                        style={{
                                            background: T.GRAY,
                                            borderColor: T.BORDER,
                                            color: T.TEXT_MUTED,
                                        }}
                                    >
                                        {group.count}
                                    </span>
                                </div>
                            )}
                            <div className="flex flex-col gap-2.5">
                                {group.exposes.map((expose) => {
                                    const meta = exposeStatusMeta(expose.status);
                                    const linked = expose.source === "linked";
                                    // The lead rollup shows exposes across several
                                    // deals — one may be locked while others
                                    // aren't, so editability is per-row, not just
                                    // the panel-wide permission check.
                                    const rowEditable = canEdit && !expose.deal_is_locked;
                                    return (
                                        <div
                                            key={expose.id}
                                            className="flex items-center gap-3.5 rounded-[10px] border p-[15px]"
                                            style={{
                                                borderColor: T.BORDER,
                                                background: T.WHITE,
                                            }}
                                        >
                                            <div
                                                aria-hidden="true"
                                                className="flex h-10 w-10 flex-none items-center justify-center rounded-lg"
                                                style={{
                                                    background: linked
                                                        ? T.BLUE_LIGHT
                                                        : T.NAVY_SOFT,
                                                }}
                                            >
                                                <DealIcon
                                                    name={
                                                        linked
                                                            ? "external-link"
                                                            : "file-text"
                                                    }
                                                    size={19}
                                                    color={linked ? T.BLUE : T.NAVY}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="group min-w-0">
                                                    {onUpdate && rowEditable ? (
                                                        <DealEditableField
                                                            value={expose.title}
                                                            fieldName="title"
                                                            fieldType="text"
                                                            disabled={!rowEditable}
                                                            className="truncate text-[15px] font-semibold"
                                                            displayValue={
                                                                <span
                                                                    className="truncate"
                                                                    style={{
                                                                        color: T.TEXT,
                                                                    }}
                                                                >
                                                                    {
                                                                        expose.title
                                                                    }
                                                                </span>
                                                            }
                                                            onSave={async (
                                                                value,
                                                            ) => {
                                                                const title =
                                                                    String(
                                                                        value,
                                                                    ).trim();
                                                                if (!title) {
                                                                    throw new Error(
                                                                        t(
                                                                            "pages.deals.workspace.exposes.validation.title_required",
                                                                        ),
                                                                    );
                                                                }
                                                                if (
                                                                    title ===
                                                                    expose.title
                                                                ) {
                                                                    return;
                                                                }
                                                                await onUpdate(
                                                                    expose.id,
                                                                    { title },
                                                                );
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="truncate text-[15px] font-semibold"
                                                            style={{
                                                                color: T.TEXT,
                                                            }}
                                                        >
                                                            {expose.title}
                                                        </div>
                                                    )}
                                                </div>
                                                {expose.source_label && (
                                                    <div
                                                        className="mt-[3px] truncate text-[13px]"
                                                        style={{ color: T.TEXT_MUTED }}
                                                    >
                                                        {expose.source_label}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mr-1.5 flex-none text-right">
                                                {linked && (
                                                    <div className="group inline-block min-w-[88px]">
                                                        {onUpdate && rowEditable ? (
                                                            <DealEditableField
                                                                value={
                                                                    expose.amount ??
                                                                    ""
                                                                }
                                                                fieldName="amount"
                                                                fieldType="currency"
                                                                disabled={!rowEditable}
                                                                className="text-[15px] font-bold text-right"
                                                                displayValue={
                                                                    <span
                                                                        style={{
                                                                            color: T.NAVY,
                                                                        }}
                                                                    >
                                                                        {formatExposeAmount(
                                                                            expose.amount,
                                                                            currencySymbol,
                                                                        )}
                                                                    </span>
                                                                }
                                                                onSave={async (
                                                                    value,
                                                                ) => {
                                                                    const amount =
                                                                        parseExposeAmount(
                                                                            value,
                                                                        );
                                                                    if (
                                                                        amount !==
                                                                            null &&
                                                                        amount < 0
                                                                    ) {
                                                                        throw new Error(
                                                                            t(
                                                                                "pages.deals.workspace.exposes.validation.amount_invalid",
                                                                            ),
                                                                        );
                                                                    }
                                                                    if (
                                                                        parseExposeAmount(
                                                                            expose.amount,
                                                                        ) === amount
                                                                    ) {
                                                                        return;
                                                                    }
                                                                    await onUpdate(
                                                                        expose.id,
                                                                        { amount },
                                                                    );
                                                                }}
                                                            />
                                                        ) : (
                                                            <div
                                                                className="text-[15px] font-bold"
                                                                style={{
                                                                    color: T.NAVY,
                                                                }}
                                                            >
                                                                {formatExposeAmount(
                                                                    expose.amount,
                                                                    currencySymbol,
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div
                                                    className={
                                                        linked
                                                            ? "mt-[3px] text-xs"
                                                            : "text-xs"
                                                    }
                                                    style={{ color: T.TEXT_HINT }}
                                                >
                                                    {formatExposeDate(expose)}
                                                </div>
                                            </div>
                                            <div className="flex-none">
                                                <DealMenuSelect
                                                    value={expose.status}
                                                    options={statusOptions}
                                                    align="right"
                                                    disabled={!rowEditable}
                                                    onChange={(value) =>
                                                        onStatusChange(
                                                            expose.id,
                                                            value as DealExposeStatus,
                                                        )
                                                    }
                                                    triggerClassName=""
                                                    triggerStyle={{
                                                        gap: 7,
                                                        padding: "7px 12px",
                                                        borderRadius: 999,
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        background: meta.background,
                                                        border: `1px solid ${meta.border}`,
                                                        color: meta.text,
                                                        whiteSpace: "nowrap",
                                                        maxWidth: "none",
                                                    }}
                                                />
                                            </div>
                                            {expose.download_url && (
                                                <button
                                                    type="button"
                                                    className="shrink-0 cursor-pointer border-none bg-transparent p-0.5"
                                                    title={t(
                                                        "pages.deals.workspace.files.download",
                                                    )}
                                                    aria-label={t(
                                                        "pages.deals.workspace.files.download",
                                                    )}
                                                    onClick={() =>
                                                        downloadDealExpose(
                                                            expose,
                                                        )
                                                    }
                                                >
                                                    <DealIcon
                                                        name="download"
                                                        size={16}
                                                        color={T.TEXT_MUTED}
                                                    />
                                                </button>
                                            )}
                                            {onRemove && (
                                                <button
                                                    type="button"
                                                    className="shrink-0 cursor-pointer border-none bg-transparent p-0.5"
                                                    title={t("pages.deals.common.delete")}
                                                    aria-label={t(
                                                        "pages.deals.common.delete",
                                                    )}
                                                    onClick={() =>
                                                        onRemove(expose.id)
                                                    }
                                                >
                                                    <DealIcon
                                                        name="trash"
                                                        size={16}
                                                        color={T.TEXT_MUTED}
                                                    />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { router } from "@inertiajs/react";
import "@/Components/Redesign/redesign.css";
import "./LeadMergeReviewModal.css";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { REDESIGN_FONT_STACK } from "@/Components/Redesign/tokens";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TdFn } from "@/lib/dynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { formatMobileForDisplay } from "@/lib/utils";
import type { IModalProps } from "@/Types/common";
import type {
    LeadMergeCombined,
    LeadMergeFieldGroup,
    LeadMergeFieldRow,
    LeadMergeGroupKey,
    LeadMergeReviewResponse,
    LeadMergeSide,
    LeadMergeSummary,
} from "@/Types/api/lead-merge";

interface Props extends IModalProps {
    primaryId: number;
    duplicateId: number;
}

type View = "differences" | "all";

const PHONE_FIELDS = new Set(["mobile", "cell", "office", "client_whatsapp"]);

/** Server-side English labels from enums and lookup tables, translated with td(). */
const DYNAMIC_VALUE_FIELDS = new Set([
    "salutation",
    "gender",
    "age_range",
    "preferred_contact_time",
    "source_id",
    "status_id",
    "lead_lifecycle_status_id",
    "temperature",
]);

/** Order of the "Moves to the kept lead" chips. */
const MOVE_ORDER = [
    "deals",
    "notes",
    "tasks",
    "meetings",
    "calls",
    "files",
    "exposes",
    "proposals",
    "consents",
    "products",
    "sally_insights",
    "qualifications",
    "communication_activities",
    "flight_itineraries",
    "partner_flags",
    "utm_touches",
    "timeline_events",
] as const;

/** A row of the comparison: a pickable field, or a value merged on its own. */
type DisplayRow =
    | { kind: "field"; row: LeadMergeFieldRow }
    | {
          kind: "combined";
          key: string;
          label: string;
          /** Both leads held the same; only listed under "All fields". */
          same: boolean;
          result: string;
          hint: string;
      };

function isDifference(row: DisplayRow): boolean {
    if (row.kind === "field") return row.row.state === "choose" || row.row.state === "fill" || row.row.state === "locked";
    return !row.same;
}

function formatDate(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function sameList(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v) => b.includes(v));
}

/**
 * Merge two leads. Everything on the duplicate moves to the kept lead; where
 * both hold different values the person picks which one stays. Fixed height:
 * the lead cards and field comparison scroll, the "Moves to the kept lead"
 * summary and the footer stay in view.
 */
export default function LeadMergeReviewModal({ open, primaryId, duplicateId, onClose }: Props) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [keptId, setKeptId] = useState(primaryId);
    const [otherId, setOtherId] = useState(duplicateId);
    const [picks, setPicks] = useState<Record<string, LeadMergeSide>>({});
    const [view, setView] = useState<View>("differences");
    const [mergeError, setMergeError] = useState(false);

    useEffect(() => {
        if (open) {
            setKeptId(primaryId);
            setOtherId(duplicateId);
            setPicks({});
            setView("differences");
            setMergeError(false);
        }
    }, [open, primaryId, duplicateId]);

    const { data, isLoading, isError, refetch } = useApiQuery<LeadMergeReviewResponse>({
        path: route("lead-contact.merge-review", { lead: keptId, duplicate: otherId }),
        options: { enabled: open },
    });

    const { mutate: confirmMerge, status } = useApiMutate<
        { duplicate_id: number; field_picks: Record<string, LeadMergeSide> },
        unknown,
        ApiResponse<unknown>
    >(route("lead-contact.merge", keptId), "POST");

    const ready = Boolean(data?.primary && data?.duplicate);
    const groups = useMemo(() => buildRows(data, t, td), [data, t, td]);
    const differenceCount = groups.reduce((n, g) => n + g.rows.filter(isDifference).length, 0);
    const allCount = groups.reduce((n, g) => n + g.rows.length, 0);
    const visibleGroups = groups
        .map((g) => ({ ...g, rows: view === "all" ? g.rows : g.rows.filter(isDifference) }))
        .filter((g) => g.rows.length > 0);

    const pickFor = (row: LeadMergeFieldRow): LeadMergeSide => picks[row.key] ?? row.default_pick;

    const swap = () => {
        setKeptId(otherId);
        setOtherId(keptId);
        setPicks({});
        setMergeError(false);
    };

    const handleConfirm = () => {
        const fieldPicks: Record<string, LeadMergeSide> = {};
        (data?.field_groups ?? []).forEach((g) =>
            g.rows.forEach((row) => {
                if (row.state === "choose") fieldPicks[row.key] = pickFor(row);
            }),
        );

        setMergeError(false);
        confirmMerge(
            { duplicate_id: otherId, field_picks: fieldPicks },
            {
                // The merge runs in one transaction: a failure changes nothing.
                onError: () => setMergeError(true),
                onSuccess: (response) => {
                    // A refused merge (Reply::error) arrives as a 200 with status "fail".
                    if (response?.status !== "success") {
                        setMergeError(true);
                        return;
                    }
                    onClose(true);
                    if (keptId !== primaryId) {
                        // The lead this dialog was opened from is now the archived
                        // one; open the lead that was kept.
                        router.visit(route("lead-contact.show", keptId));
                    } else {
                        router.reload({ only: ["leads", "lead"] });
                    }
                },
            },
        );
    };

    const moves = MOVE_ORDER.map((key) => [key, data?.moves?.[key] ?? 0] as const).filter(([, n]) => n > 0);

    const valueText = (row: LeadMergeFieldRow, side: LeadMergeSide): string | null => {
        const value = side === "primary" ? row.primary : row.duplicate;
        if (value == null || value === "") return null;
        if (PHONE_FIELDS.has(row.key)) return formatMobileForDisplay(value) || value;
        if (DYNAMIC_VALUE_FIELDS.has(row.key)) return td(value, { source: "en" });
        return value;
    };

    const fieldLabel = (row: LeadMergeFieldRow): string =>
        row.custom ? td(row.label, { source: "en" }) : t(`pages.lead_merge.fields.${row.key.replace(":", "_")}`);

    const hintFor = (row: LeadMergeFieldRow, side: LeadMergeSide): string | null => {
        if (row.state === "fill" && side === "duplicate") return t("pages.lead_merge.hint_filled");
        if (row.state === "locked" && side === "primary") return t("pages.lead_merge.hint_referrer_locked");
        if (row.state !== "choose") return null;
        if (row.hint === "kept_as_alternate" && side === "duplicate") {
            return row.key === "client_email"
                ? t("pages.lead_merge.hint_alternate_email")
                : t("pages.lead_merge.hint_alternate_phone");
        }
        if (row.hint === "higher_score" && side === row.default_pick) return t("pages.lead_merge.hint_higher_score");
        if (row.hint === "touch_history" && side === pickFor(row)) return t("pages.lead_merge.hint_touch_history");
        return null;
    };

    const renderOption = (row: LeadMergeFieldRow, side: LeadMergeSide) => {
        const text = valueText(row, side);
        const hint = hintFor(row, side);
        const content = (
            <>
                <span className="lm-dot" aria-hidden="true" />
                <span style={{ minWidth: 0 }}>
                    {text ? <span>{text}</span> : <span className="lm-empty">{t("pages.lead_merge.empty")}</span>}
                    {hint && <span className="lm-hint">{hint}</span>}
                </span>
            </>
        );

        if (row.state === "choose") {
            const on = pickFor(row) === side;
            return (
                <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`lm-opt${on ? " is-on" : ""}`}
                    onClick={() => setPicks((prev) => ({ ...prev, [row.key]: side }))}
                >
                    {content}
                </button>
            );
        }

        // Nothing to choose: the kept lead ends up with the only value there is.
        const on = row.state === "fill" ? side === "duplicate" : side === "primary";
        return <div className={`lm-opt${on ? " is-on" : ""}`}>{content}</div>;
    };

    const renderRow = (row: DisplayRow) => {
        if (row.kind === "field") {
            const label = fieldLabel(row.row);
            if (row.row.state === "same") {
                return (
                    <div key={row.row.key} className="lm-row">
                        <div className="lm-label">{label}</div>
                        <div className="lm-opt is-on is-span">
                            <span className="lm-dot" aria-hidden="true" />
                            <span>{valueText(row.row, "primary")}</span>
                        </div>
                    </div>
                );
            }
            return (
                <div
                    key={row.row.key}
                    className="lm-row"
                    role={row.row.state === "choose" ? "radiogroup" : undefined}
                    aria-label={row.row.state === "choose" ? label : undefined}
                >
                    <div className="lm-label">{label}</div>
                    {renderOption(row.row, "primary")}
                    {renderOption(row.row, "duplicate")}
                </div>
            );
        }

        return (
            <div key={row.key} className="lm-row">
                <div className="lm-label">{row.label}</div>
                <div className="lm-opt is-on is-span">
                    <span className="lm-dot" aria-hidden="true" />
                    <span style={{ minWidth: 0 }}>
                        <span>{row.result}</span>
                        <span className="lm-hint">{row.hint}</span>
                    </span>
                </div>
            </div>
        );
    };

    const leadCard = (summary: LeadMergeSummary, kept: boolean, counts?: Record<string, number>) => {
        const created = formatDate(summary.created_at);
        const meta = [
            t("pages.lead_merge.lead_number", { id: String(summary.id) }),
            created ? t("pages.lead_merge.created_on", { date: created }) : null,
            summary.owner_name ? t("pages.lead_merge.owner_name", { name: summary.owner_name }) : t("pages.lead_merge.no_owner"),
            ...(["deals", "notes", "tasks"] as const)
                .filter((k) => (counts?.[k] ?? 0) > 0)
                .map((k) => moveLabel(k, counts?.[k] ?? 0)),
        ].filter(Boolean);

        return (
            <div className={`lm-card${kept ? " is-kept" : ""}`}>
                <div className="lm-card-eyebrow">
                    {kept ? t("pages.lead_merge.kept_lead") : t("pages.lead_merge.duplicate_archived")}
                </div>
                <div className="lm-card-name" title={summary.client_name ?? undefined}>
                    {summary.client_name || "—"}
                </div>
                <div className="lm-card-meta">{meta.join(" · ")}</div>
            </div>
        );
    };

    const moveLabel = (key: string, count: number) =>
        count === 1
            ? t(`pages.lead_merge.moves.${key}_one`)
            : t(`pages.lead_merge.moves.${key}_other`, { count: String(count) });

    let body: ReactNode;
    if (isLoading && !data) {
        body = (
            <div className="lm-scroll" aria-busy="true" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
                {[72, 36, 44, 44, 44, 44, 44].map((h, i) => (
                    <div key={i} className="dr-skeleton" style={{ height: h, borderRadius: 8 }} />
                ))}
            </div>
        );
    } else if (isError || (data && !ready)) {
        body = (
            <div className="lm-scroll" style={{ padding: 22 }}>
                <EmptyState
                    role="alert"
                    title={(data as unknown as { message?: string } | undefined)?.message ?? t("pages.lead_merge.load_failed")}
                    action={{ label: t("pages.lead_merge.retry"), onClick: () => void refetch() }}
                />
            </div>
        );
    } else if (data?.primary && data.duplicate) {
        body = (
            <>
                <div className="lm-scroll">
                    <div className="lm-cards">
                        {leadCard(data.primary, true, data.counts?.primary as unknown as Record<string, number>)}
                        <button
                            type="button"
                            className="lm-swap"
                            onClick={swap}
                            title={t("pages.lead_merge.swap")}
                            aria-label={t("pages.lead_merge.swap")}
                        >
                            <Icon name="swap" size={15} />
                        </button>
                        {leadCard(data.duplicate, false, data.counts?.duplicate as unknown as Record<string, number>)}
                    </div>

                    <div className="lm-toolbar">
                        <Segmented<View>
                            value={view}
                            onChange={setView}
                            ariaLabel={t("pages.lead_merge.view_label")}
                            variant="raised"
                            options={[
                                { value: "differences", label: t("pages.lead_merge.view_differences"), count: differenceCount },
                                { value: "all", label: t("pages.lead_merge.view_all"), count: allCount },
                            ]}
                        />
                        <span className="lm-toolbar-hint">{t("pages.lead_merge.auto_fill_hint")}</span>
                    </div>

                    {visibleGroups.length === 0 ? (
                        <div className="lm-none">{t("pages.lead_merge.no_differences")}</div>
                    ) : (
                        <>
                            <div className="lm-heads" aria-hidden="true">
                                <span />
                                <span>{t("pages.lead_merge.kept_lead")}</span>
                                <span>{t("pages.lead_merge.duplicate")}</span>
                            </div>
                            {visibleGroups.map((group) => (
                                <section key={group.key} aria-label={t(`pages.lead_merge.group_${group.key}`)}>
                                    <div className="lm-group">
                                        {t(`pages.lead_merge.group_${group.key}`)}
                                        {view === "differences" && <span className="lm-chip">{group.rows.length}</span>}
                                    </div>
                                    {group.rows.map(renderRow)}
                                </section>
                            ))}
                        </>
                    )}
                </div>

                <section className="lm-moves" aria-label={t("pages.lead_merge.moves_title")}>
                    <div className="lm-moves-title">{t("pages.lead_merge.moves_title")}</div>
                    {moves.length > 0 ? (
                        <ul className="lm-moves-list">
                            {moves.map(([key, n]) => (
                                <li key={key}>{moveLabel(key, n)}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="lm-toolbar-hint">{t("pages.lead_merge.moves_nothing")}</div>
                    )}
                </section>
            </>
        );
    }

    return (
        <Modal
            open={open}
            title={t("pages.lead_merge.title")}
            subtitle={t("pages.lead_merge.subtitle")}
            onClose={() => onClose()}
            maxWidth={980}
            fixedHeight={820}
            // Opened from antd screens (lead list, Find duplicates) as well as the
            // lead page, so it sits above an antd modal.
            zIndex={1500}
            footer={
                <>
                    {mergeError ? (
                        <span className="lm-footer-note is-error" role="alert">
                            {t("pages.lead_merge.merge_failed")}
                        </span>
                    ) : (
                        <span className="lm-footer-note">{t("pages.lead_merge.footer_note")}</span>
                    )}
                    <Button variant="ghost" onClick={() => onClose()}>
                        {t("pages.lead_merge.cancel")}
                    </Button>
                    <Button variant="primary" loading={status === "pending"} disabled={!ready} onClick={handleConfirm}>
                        {t("pages.lead_merge.confirm")}
                    </Button>
                </>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, fontFamily: REDESIGN_FONT_STACK }}>
                {body}
            </div>
        </Modal>
    );
}

/** Turns the review payload into grouped rows, with the merged-on-its-own values in their groups. */
function buildRows(
    data: LeadMergeReviewResponse | undefined,
    t: (key: string, params?: Record<string, string>) => string,
    td: TdFn,
): Array<{ key: LeadMergeGroupKey; rows: DisplayRow[] }> {
    if (!data?.primary) return [];

    const byKey = new Map<LeadMergeGroupKey, DisplayRow[]>();
    (data.field_groups ?? []).forEach((g: LeadMergeFieldGroup) =>
        byKey.set(g.key, g.rows.map((row) => ({ kind: "field" as const, row }))),
    );

    const add = (group: LeadMergeGroupKey, row: DisplayRow) => {
        byKey.set(group, [...(byKey.get(group) ?? []), row]);
    };
    const combined: LeadMergeCombined = data.combined ?? {};

    if (combined.languages) {
        const { primary, duplicate, result } = combined.languages;
        add("personal", {
            kind: "combined",
            key: "languages",
            label: t("pages.lead_merge.row_languages"),
            same: sameList(primary, duplicate),
            result: result.map((l) => td(l, { source: "en" })).join(", "),
            hint: t("pages.lead_merge.hint_combined"),
        });
    }

    if (combined.categories) {
        const { primary, duplicate, result } = combined.categories;
        add("status", {
            kind: "combined",
            key: "categories",
            label: t("pages.lead_merge.row_categories"),
            same: sameList(primary, duplicate),
            result: result.map((c) => td(c, { source: "en" })).join(", "),
            hint: t("pages.lead_merge.hint_combined"),
        });
    }

    if (combined.engagement?.length) {
        add("marketing", {
            kind: "combined",
            key: "engagement",
            label: t("pages.lead_merge.row_engagement"),
            same: combined.engagement.every((f) => f.primary === f.duplicate),
            result: combined.engagement.map((f) => t(`pages.lead_merge.flag_${f.key}`)).join(" · "),
            hint: t("pages.lead_merge.hint_engagement"),
        });
    }

    if (combined.last_webinar_date?.result) {
        const w = combined.last_webinar_date;
        add("marketing", {
            kind: "combined",
            key: "last_webinar_date",
            label: t("pages.lead_merge.row_last_webinar"),
            same: w.primary === w.duplicate,
            result: w.result ?? "",
            hint: t("pages.lead_merge.hint_latest_date"),
        });
    }

    const order: LeadMergeGroupKey[] = ["contact", "personal", "status", "ownership", "marketing", "custom"];
    return order
        .map((key) => ({ key, rows: byKey.get(key) ?? [] }))
        .filter((g) => g.rows.length > 0);
}

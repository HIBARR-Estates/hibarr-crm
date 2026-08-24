import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, message } from "antd";
import { router } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TdFn } from "@/lib/dynamicTranslation";
import { getCurrentQueryParams } from "@/lib/inertiaQuery";
import {
    CheckList,
    FieldShell,
    PillGroup,
    TemperatureCards,
    fmt,
} from "@/Features/Filters/controls";
import "@/Features/Filters/entity-filter-modal.css";
import {
    asArray,
    groupBulkUpdateFieldsBySection,
    type BulkUpdateFieldDef,
    type BulkUpdateValue as DraftValue,
} from "./bulkUpdateFields";
import type { BulkTarget } from "./bulkTarget";
import type { BulkActionSummaryData } from "./BulkActionSummary";
import BulkActionConfirm from "./BulkActionConfirm";
import { buildBulkTargetPayload } from "./bulkTarget";

interface Props {
    open: boolean;
    onClose: (operationSucceeded?: boolean) => void;
    target: BulkTarget;
    /** Fields this entity can bulk-update (see bulkUpdateFields). */
    fields: BulkUpdateFieldDef[];
    /** POST endpoint accepting `action_type: "bulk_update"`. */
    endpoint: string;
    /** Singular noun for the copy, e.g. "lead" / "deal". */
    entityLabel: string;
    /** Inertia prop to refresh after a successful update. */
    reloadOnly: string;
    /** Receipt for the list view once the update lands. */
    onCompleted?: (summary: BulkActionSummaryData) => void;
    /** Entity-wide caveat for the confirmation step, e.g. locked rows. */
    actionNote?: string;
    optionsLoading?: boolean;
}

function takeSingle(next: Array<string | number>): string | number | null {
    if (next.length === 0) return null;
    return next[next.length - 1];
}

function describePending(
    field: BulkUpdateFieldDef,
    value: DraftValue,
    td: TdFn,
): string {
    if (field.control === "pills" || field.control === "checklist") {
        const ids = asArray(value);
        if (ids.length === 0) {
            return td(`Clear ${field.label.toLowerCase()}`, { source: "en" });
        }
        const labels = field.options
            .filter((option) => ids.map(String).includes(String(option.value)))
            .map((option) => option.label);
        return `${field.label} → ${labels.join(", ") || ids.join(", ")}`;
    }

    if (value == null || value === "") {
        return td(`Clear ${field.label.toLowerCase()}`, { source: "en" });
    }

    const label =
        field.options.find((option) => String(option.value) === String(value))
            ?.label ?? String(value);
    return `${field.label} → ${label}`;
}

function fieldIsCleared(field: BulkUpdateFieldDef, value: DraftValue): boolean {
    if (field.control === "pills" || field.control === "checklist") {
        return asArray(value).length === 0;
    }
    return value == null || value === "";
}

function fieldIsReady(field: BulkUpdateFieldDef, value: DraftValue): boolean {
    if (field.control === "pills" || field.control === "checklist") {
        return field.clearable || asArray(value).length > 0;
    }

    if (value == null || value === "") {
        return field.clearable;
    }

    return true;
}

/**
 * LFM-styled bulk update workbench: scroll sections like the filter modal and
 * apply multiple option-backed fields in one submit. Entity-agnostic — the
 * caller supplies the fields (each carrying its own payload mapping) and the
 * endpoint that accepts them.
 */
export default function BulkUpdateModal({
    open,
    onClose,
    target,
    fields,
    endpoint,
    entityLabel,
    reloadOnly,
    onCompleted,
    actionNote,
    optionsLoading = false,
}: Props) {
    const { td } = useTd();
    const paneRef = useRef<HTMLDivElement | null>(null);
    const sections = useMemo(
        () => groupBulkUpdateFieldsBySection(fields),
        [fields],
    );

    const [activeSection, setActiveSection] = useState<string | null>(
        sections[0]?.name ?? null,
    );
    const [draft, setDraft] = useState<Record<string, DraftValue>>({});
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDraft({});
        setConfirming(false);
        setActiveSection(sections[0]?.name ?? null);
    }, [open, sections]);

    const pendingFields = useMemo(() => {
        return fields.filter((field) =>
            Object.prototype.hasOwnProperty.call(draft, field.key),
        );
    }, [fields, draft]);

    const summaries = useMemo(
        () =>
            pendingFields
                .filter((field) => fieldIsReady(field, draft[field.key] ?? null))
                .map((field) =>
                    describePending(field, draft[field.key] ?? null, td),
                ),
        [pendingFields, draft, td],
    );

    const canSubmit =
        pendingFields.length > 0 &&
        pendingFields.every((field) =>
            fieldIsReady(field, draft[field.key] ?? null),
        );

    const { mutate: bulkUpdate, status } = useApiMutate<
        Record<string, unknown>,
        unknown,
        ApiResponse<{ message?: string }>
    >(endpoint, "POST");

    const loading = getLoadingStatus({ status });
    const countPhrase = `${fmt(target.count)} ${
        target.count === 1 ? entityLabel : `${entityLabel}s`
    }`;

    const setFieldValue = (key: string, value: DraftValue) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const clearField = (field: BulkUpdateFieldDef) => {
        if (!field.clearable) return;
        setFieldValue(
            field.key,
            field.control === "pills" || field.control === "checklist"
                ? []
                : null,
        );
    };

    const isClearActive = (field: BulkUpdateFieldDef) =>
        Object.prototype.hasOwnProperty.call(draft, field.key) &&
        fieldIsCleared(field, draft[field.key] ?? null);

    const scrollToSection = (name: string) => {
        setActiveSection(name);
        const node = paneRef.current?.querySelector<HTMLElement>(
            `[data-section="${CSS.escape(name)}"]`,
        );
        node?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const sectionDirtyCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const section of sections) {
            counts[section.name] = section.fields.filter((field) =>
                Object.prototype.hasOwnProperty.call(draft, field.key),
            ).length;
        }
        return counts;
    }, [sections, draft]);

    const buildPayload = (): Record<string, unknown> | null => {
        if (!canSubmit) return null;

        const payload: Record<string, unknown> = {
            ...buildBulkTargetPayload(target),
            ...getCurrentQueryParams(),
            action_type: "bulk_update",
            fields: pendingFields.map((field) => field.key),
        };

        // Drop pagination noise from the URL merge.
        delete payload.page;
        delete payload.per_page;

        for (const field of pendingFields) {
            Object.assign(payload, field.toPayload(draft[field.key] ?? null));
        }

        return payload;
    };

    // Everything a reviewer should know before committing: the caveats of the
    // fields they touched, plus the fact that "all matching" reaches rows that
    // are not on screen.
    const confirmNotes = useMemo(() => {
        const notes = pendingFields.flatMap((field) =>
            field.confirmNote
                ? ([] as string[]).concat(field.confirmNote)
                : [],
        );

        if (target.mode === "all_matching") {
            notes.unshift(
                td(
                    `This applies to every ${entityLabel} matching the current filters, not just the rows on this page.`,
                    { source: "en" },
                ),
            );
        }

        if (actionNote) notes.push(actionNote);

        return notes;
    }, [pendingFields, target.mode, entityLabel, actionNote, td]);

    const handleSubmit = () => {
        if (!buildPayload()) return;
        setConfirming(true);
    };

    const runUpdate = () => {
        const payload = buildPayload();
        if (!payload) return;

        bulkUpdate(payload, {
            suppressSuccessToast: true,
            onSuccess: (response) => {
                const result = response as {
                    message?: string;
                    summary?: {
                        updated?: number;
                        skipped?: Array<{ count: number; reason: string }>;
                    };
                };

                message.success(
                    result?.message || td(`Updated ${countPhrase}`, { source: "en" }),
                );

                // The toast goes away; the receipt above the list does not.
                onCompleted?.({
                    verb: td("updated", { source: "en" }),
                    entityLabel: `${entityLabel}s`,
                    count: result?.summary?.updated ?? target.count,
                    changes: summaries,
                    skipped: result?.summary?.skipped ?? [],
                });

                setConfirming(false);
                onClose(true);
                router.reload({ only: [reloadOnly] });
            },
            onError: (error: unknown) => {
                const detail =
                    (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message ||
                    td(`Failed to update ${entityLabel}s`, { source: "en" });
                message.error(detail);
                setConfirming(false);
            },
        });
    };

    const handleClose = () => {
        if (loading || confirming) return;
        onClose();
    };

    const renderControl = (field: BulkUpdateFieldDef) => {
        const value = draft[field.key] ?? null;

        switch (field.control) {
            case "pills":
                return (
                    <PillGroup
                        options={field.options}
                        value={asArray(value)}
                        onChange={(next) => setFieldValue(field.key, next)}
                    />
                );
            case "pills-single":
                return (
                    <PillGroup
                        options={field.options}
                        value={asArray(value)}
                        onChange={(next) =>
                            setFieldValue(field.key, takeSingle(next))
                        }
                    />
                );
            case "temperature":
                return (
                    <TemperatureCards
                        options={field.options}
                        value={asArray(value)}
                        onChange={(next) =>
                            setFieldValue(field.key, takeSingle(next))
                        }
                    />
                );
            case "checklist":
                return (
                    <CheckList
                        options={field.options}
                        value={asArray(value)}
                        onChange={(next) => setFieldValue(field.key, next)}
                        searchPlaceholder={td("Search people…", {
                            source: "en",
                        })}
                    />
                );
            case "checklist-single":
                return (
                    <CheckList
                        options={field.options}
                        value={asArray(value)}
                        onChange={(next) =>
                            setFieldValue(field.key, takeSingle(next))
                        }
                        searchPlaceholder={td("Search people…", {
                            source: "en",
                        })}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            footer={null}
            closable={false}
            width={920}
            centered
            destroyOnClose
            className="lfm-modal"
        >
            <div className="lfm" style={{ height: 580 }}>
                <header className="lfm-header">
                    <div>
                        <h2 className="lfm-header__title">
                            {td("Bulk update", { source: "en" })}
                        </h2>
                        <p className="lfm-header__sub">
                            {target.mode === "all_matching"
                                ? td(
                                      `Set one or more fields on every ${entityLabel} in the current filtered list.`,
                                      { source: "en" },
                                  )
                                : td(
                                      `Set one or more fields on the selected ${entityLabel}s.`,
                                      { source: "en" },
                                  )}
                        </p>
                    </div>
                    <div className="lfm-header__actions">
                        <button
                            type="button"
                            className="lfm-btn"
                            onClick={() => setDraft({})}
                            disabled={Object.keys(draft).length === 0 || loading}
                        >
                            {td("Reset", { source: "en" })}
                        </button>
                        <button
                            type="button"
                            className="lfm-iconbtn"
                            onClick={handleClose}
                            aria-label={td("Close", { source: "en" })}
                            disabled={loading}
                        >
                            ✕
                        </button>
                    </div>
                </header>

                <div className="lfm-body">
                    <nav className="lfm-rail">
                        {sections.map((section) => (
                            <button
                                key={section.name}
                                type="button"
                                className={`lfm-rail__item${
                                    activeSection === section.name
                                        ? " is-on"
                                        : ""
                                }`}
                                onClick={() => scrollToSection(section.name)}
                            >
                                <span>
                                    {td(section.name, { source: "en" })}
                                </span>
                                {sectionDirtyCounts[section.name] > 0 ? (
                                    <span className="lfm-rail__badge">
                                        {sectionDirtyCounts[section.name]}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                        <div className="lfm-rail__spacer" />
                        <div className="lfm-estimate">
                            <div className="lfm-estimate__label">
                                {td("Updating", { source: "en" })}
                            </div>
                            <div className="lfm-estimate__value">
                                {countPhrase}
                            </div>
                            <div className="lfm-estimate__sub">
                                {target.mode === "all_matching"
                                    ? td("All matching filters", {
                                          source: "en",
                                      })
                                    : td("Selected rows", { source: "en" })}
                            </div>
                        </div>
                    </nav>

                    <div className="lfm-pane" ref={paneRef}>
                        {optionsLoading && (
                            <div className="lfm-loading">
                                {td("Loading options…", { source: "en" })}
                            </div>
                        )}
                        {sections.map((section) => (
                            <section
                                key={section.name}
                                className="lfm-section"
                                data-section={section.name}
                            >
                                <h3 className="lfm-section__title">
                                    {td(section.name, { source: "en" })}
                                </h3>
                                <div className="lfm-section__fields">
                                    {section.fields.map((field) => {
                                        const clearActive = isClearActive(field);
                                        return (
                                            <FieldShell
                                                key={field.key}
                                                label={td(field.label, {
                                                    source: "en",
                                                })}
                                                hint={
                                                    field.hint
                                                        ? td(field.hint, {
                                                              source: "en",
                                                          })
                                                        : undefined
                                                }
                                                action={
                                                    field.clearable ? (
                                                        <button
                                                            type="button"
                                                            className={`lfm-btn lfm-btn--clear${
                                                                clearActive
                                                                    ? " is-on"
                                                                    : ""
                                                            }`}
                                                            onClick={() =>
                                                                clearField(
                                                                    field,
                                                                )
                                                            }
                                                            disabled={loading}
                                                            aria-pressed={
                                                                clearActive
                                                            }
                                                        >
                                                            {td("Clear value", {
                                                                source: "en",
                                                            })}
                                                        </button>
                                                    ) : undefined
                                                }
                                            >
                                                {renderControl(field)}
                                            </FieldShell>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>

                <footer className="lfm-footer">
                    <div className="lfm-tray">
                        {summaries.length > 0 ? (
                            summaries.map((summary) => (
                                <span
                                    key={summary}
                                    className="lfm-tray__chip"
                                >
                                    {summary}
                                </span>
                            ))
                        ) : (
                            <span
                                style={{
                                    fontSize: 12.5,
                                    color: "#9ca3af",
                                }}
                            >
                                {td("Pick one or more fields to update", {
                                    source: "en",
                                })}
                            </span>
                        )}
                    </div>
                    <div className="lfm-footer__actions">
                        <button
                            type="button"
                            className="lfm-btn"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            {td("Cancel", { source: "en" })}
                        </button>
                        <button
                            type="button"
                            className="lfm-btn lfm-btn--primary"
                            onClick={handleSubmit}
                            disabled={!canSubmit || loading}
                        >
                            {loading
                                ? td("Updating…", { source: "en" })
                                : td(`Review ${countPhrase}`, {
                                      source: "en",
                                  })}
                        </button>
                    </div>
                </footer>
            </div>

            <BulkActionConfirm
                open={confirming}
                count={target.count}
                entityLabel={
                    target.count === 1 ? entityLabel : `${entityLabel}s`
                }
                changes={summaries}
                notes={confirmNotes}
                confirmLabel={td(`Update ${countPhrase}`, { source: "en" })}
                loading={loading}
                onConfirm={runUpdate}
                onCancel={() => setConfirming(false)}
            />
        </Modal>
    );
}

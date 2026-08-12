import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, message } from "antd";
import { router } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { getCurrentQueryParams } from "@/lib/inertiaQuery";
import {
    CheckList,
    FieldShell,
    PillGroup,
    TemperatureCards,
    fmt,
} from "@/Features/Leads/Filters/controls";
import "@/Features/Leads/Filters/lead-filter-modal.css";
import {
    createLeadBulkUpdateFields,
    groupBulkUpdateFieldsBySection,
    type BulkUpdateFieldDef,
    type BulkUpdateOptionsInput,
} from "./bulkUpdateConfig";
import type { LeadBulkTarget } from "./bulkTarget";
import { buildBulkTargetPayload } from "./bulkTarget";

interface Props {
    open: boolean;
    onClose: (operationSucceeded?: boolean) => void;
    target: LeadBulkTarget;
    options: BulkUpdateOptionsInput;
    optionsLoading?: boolean;
}

type DraftValue = string | number | boolean | Array<string | number> | null;

function asArray(value: DraftValue): Array<string | number> {
    if (value == null || value === false) return [];
    if (Array.isArray(value)) return value;
    return [value as string | number];
}

function takeSingle(next: Array<string | number>): string | number | null {
    if (next.length === 0) return null;
    return next[next.length - 1];
}

function describePending(
    field: BulkUpdateFieldDef,
    value: DraftValue,
): { text: string; translate: boolean } {
    if (field.control === "pills") {
        const ids = asArray(value);
        if (ids.length === 0) {
            return { text: "Clear categories", translate: true };
        }
        const labels = field.options
            .filter((option) => ids.map(String).includes(String(option.value)))
            .map((option) => option.label);
        return {
            text: `${field.label} → ${labels.join(", ") || ids.join(", ")}`,
            translate: false,
        };
    }

    if (value == null || value === "") {
        return {
            text: `Clear ${field.label.toLowerCase()}`,
            translate: true,
        };
    }

    const label =
        field.options.find((option) => String(option.value) === String(value))
            ?.label ?? String(value);
    return { text: `${field.label} → ${label}`, translate: false };
}

function fieldIsCleared(field: BulkUpdateFieldDef, value: DraftValue): boolean {
    if (field.control === "pills") {
        return asArray(value).length === 0;
    }
    return value == null || value === "";
}

function fieldIsReady(field: BulkUpdateFieldDef, value: DraftValue): boolean {
    if (field.control === "pills") {
        return field.clearable || asArray(value).length > 0;
    }

    if (field.key === "has_joined_the_whatsapp_group") {
        return (
            value === true ||
            value === false ||
            value === 1 ||
            value === 0 ||
            value === "1" ||
            value === "0"
        );
    }

    if (value == null || value === "") {
        return field.clearable;
    }

    return true;
}

/**
 * LFM-styled bulk update workbench: scroll sections like the filter modal and
 * apply multiple option-backed fields in one submit.
 */
export default function BulkUpdateModal({
    open,
    onClose,
    target,
    options,
    optionsLoading = false,
}: Props) {
    const { td } = useTd();
    const paneRef = useRef<HTMLDivElement | null>(null);
    const fields = useMemo(
        () => createLeadBulkUpdateFields(options),
        [options],
    );
    const sections = useMemo(
        () => groupBulkUpdateFieldsBySection(fields),
        [fields],
    );

    const [activeSection, setActiveSection] = useState<string | null>(
        sections[0]?.name ?? null,
    );
    const [draft, setDraft] = useState<Record<string, DraftValue>>({});

    useEffect(() => {
        if (!open) return;
        setDraft({});
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
                .map((field) => {
                    const pending = describePending(
                        field,
                        draft[field.key] ?? null,
                    );
                    return pending.translate
                        ? td(pending.text, { source: "en" })
                        : pending.text;
                }),
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
    >(route("lead-contact.apply_quick_action"), "POST");

    const loading = getLoadingStatus({ status });
    const leadWord = target.count === 1 ? "lead" : "leads";
    const countPhrase = `${fmt(target.count)} ${leadWord}`;

    const setFieldValue = (key: string, value: DraftValue) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const clearField = (field: BulkUpdateFieldDef) => {
        if (!field.clearable) return;
        setFieldValue(
            field.key,
            field.control === "pills" ? [] : null,
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
            const value = draft[field.key] ?? null;
            switch (field.actionType) {
                case "change_category":
                    payload.category_ids = asArray(value)
                        .map(Number)
                        .filter(Boolean);
                    break;
                case "change_source":
                    payload.source_id =
                        value == null || value === "" ? null : Number(value);
                    break;
                case "change_owner":
                    payload.lead_owner =
                        value == null || value === "" ? null : Number(value);
                    break;
                case "change_temperature":
                    payload.temperature =
                        value == null || value === "" ? null : String(value);
                    break;
                case "change_lifecycle_status":
                    payload.lead_lifecycle_status_id =
                        value == null || value === "" ? null : Number(value);
                    break;
                case "change_whatsapp_group":
                    payload.has_joined_the_whatsapp_group =
                        value === true || value === 1 || value === "1";
                    break;
            }
        }

        return payload;
    };

    const handleSubmit = () => {
        const payload = buildPayload();
        if (!payload) return;

        bulkUpdate(payload, {
            suppressSuccessToast: true,
            onSuccess: (response) => {
                message.success(
                    (response as { message?: string })?.message ||
                        td("Leads updated successfully", { source: "en" }),
                );
                onClose(true);
                router.reload({ only: ["leads"] });
            },
            onError: (error: unknown) => {
                const detail =
                    (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message ||
                    td("Failed to update leads", { source: "en" });
                message.error(detail);
            },
        });
    };

    const handleClose = () => {
        if (loading) return;
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
                                      "Set one or more fields on every lead in the current filtered list.",
                                      { source: "en" },
                                  )
                                : td(
                                      "Set one or more fields on the selected leads.",
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
                                                    field.control === "pills"
                                                        ? td(
                                                              "Replaces existing categories",
                                                              {
                                                                  source: "en",
                                                              },
                                                          )
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
                                : td(`Update ${countPhrase}`, {
                                      source: "en",
                                  })}
                        </button>
                    </div>
                </footer>
            </div>
        </Modal>
    );
}

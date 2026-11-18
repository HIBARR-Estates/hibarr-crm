import React, { useMemo, useState } from "react";
import type { FilterFieldConfig, FilterOption } from "@/contexts/FilterContext";
import { fmt } from "./controls";
import { useTranslation } from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface UtmSectionProps {
    fields: FilterFieldConfig[];
    filters: Record<string, any>;
    onChange: (key: string, next: any[]) => void;
}

function optionsOf(field: FilterFieldConfig): FilterOption[] {
    const options =
        typeof field.options === "function" ? field.options() : field.options;
    return options ?? [];
}

/** Bold the matched substring, like the mockup's search results. */
function highlight(label: string, query: string): React.ReactNode {
    const q = query.trim();
    if (!q) return label;
    const index = label.toLowerCase().indexOf(q.toLowerCase());
    if (index < 0) return label;
    return (
        <>
            {label.slice(0, index)}
            <b>{label.slice(index, index + q.length)}</b>
            {label.slice(index + q.length)}
        </>
    );
}

function UtmFieldCard({
    field,
    value,
    onChange,
    onRemove,
}: {
    field: FilterFieldConfig;
    value: any[];
    onChange: (next: any[]) => void;
    onRemove: () => void;
}) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const options = optionsOf(field);
    const selected = new Set((value ?? []).map(String));

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((option) =>
            String(option.label).toLowerCase().includes(q),
        );
    }, [options, query]);

    const toggle = (optionValue: any) => {
        const key = String(optionValue);
        onChange(
            selected.has(key)
                ? (value ?? []).filter((v) => String(v) !== key)
                : [...(value ?? []), optionValue],
        );
    };

    const searching = query.trim() !== "";

    return (
        <div className={`lfm-utm__card${searching ? " is-active" : ""}`}>
            <div className="lfm-utm__head">
                <span className="lfm-utm__name">{field.key}</span>
                <span className="lfm-utm__meta">
                    {searching
                        ? t("pages.filters.utm_matches", { n: matches.length })
                        : t("pages.filters.utm_selected_of", {
                              selected: selected.size,
                              total: options.length,
                          })}
                </span>
                <button
                    type="button"
                    className="lfm-utm__remove"
                    onClick={onRemove}
                >
                    {t("pages.filters.remove")}
                </button>
            </div>

            <div className="lfm-utm__body">
                <input
                    className="lfm-utm__search"
                    value={query}
                    placeholder={t("pages.filters.search_values")}
                    onChange={(event) => setQuery(event.target.value)}
                />

                {options.length === 0 ? (
                    <div className="lfm-empty">
                        {t("pages.filters.utm_none_recorded", { field: field.key })}
                    </div>
                ) : searching ? (
                    <>
                        <div className="lfm-utm__list">
                            {matches.map((option) => {
                                const isOn = selected.has(String(option.value));
                                return (
                                    <button
                                        key={String(option.value)}
                                        type="button"
                                        className={`lfm-utm__row${isOn ? " is-on" : ""}`}
                                        onClick={() => toggle(option.value)}
                                    >
                                        <span
                                            className={`lfm-check${isOn ? " is-on" : ""}`}
                                        >
                                            {isOn ? "✓" : ""}
                                        </span>
                                        <span className="lfm-utm__rowname">
                                            {highlight(
                                                String(option.label),
                                                query,
                                            )}
                                        </span>
                                        {(option as any).count != null && (
                                            <span className="lfm-utm__rowcount">
                                                {t("pages.filters.count_leads", {
                                                    n: fmt((option as any).count),
                                                })}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            {matches.length === 0 && (
                                <div className="lfm-empty lfm-empty--pad">
                                    {t("pages.filters.utm_no_match", { query })}
                                </div>
                            )}
                        </div>
                        {matches.length > 0 && (
                            <button
                                type="button"
                                className="lfm-utm__selectall"
                                onClick={() =>
                                    onChange(
                                        Array.from(
                                            new Set([
                                                ...(value ?? []),
                                                ...matches.map((m) => m.value),
                                            ]),
                                        ),
                                    )
                                }
                            >
                                {t("pages.filters.utm_select_all", { n: matches.length })}
                            </button>
                        )}
                    </>
                ) : (
                    <div className="lfm-pills">
                        {options.slice(0, 12).map((option) => {
                            const isOn = selected.has(String(option.value));
                            return (
                                <button
                                    key={String(option.value)}
                                    type="button"
                                    className={`lfm-pill${isOn ? " is-on" : ""}`}
                                    onClick={() => toggle(option.value)}
                                >
                                    {td(option.label, { source: "en" })}
                                    {(option as any).count != null && (
                                        <span className="lfm-pill__count">
                                            {fmt((option as any).count)}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Campaign (UTM) section — mockup 2a. Fields are opt-in: nothing is shown until
 * the user adds it, because most teams never filter by UTM at all.
 */
export default function UtmSection({
    fields,
    filters,
    onChange,
}: UtmSectionProps) {
    const { t } = useTranslation();
    // A field is "added" once it has a value, or once explicitly opened.
    const [opened, setOpened] = useState<string[]>([]);

    const activeFields = fields.filter((field) => {
        const value = filters[field.key];
        return (
            (Array.isArray(value) && value.length > 0) ||
            opened.includes(field.key)
        );
    });
    const availableFields = fields.filter(
        (field) => !activeFields.includes(field),
    );

    const reading = activeFields
        .map((field) => {
            const value = filters[field.key];
            if (!Array.isArray(value) || value.length === 0) return null;
            return { key: field.key, values: value.map(String) };
        })
        .filter(Boolean) as Array<{ key: string; values: string[] }>;

    return (
        <div className="lfm-utm">
            <p className="lfm-section__blurb">
                {t("pages.filters.utm_blurb")}
            </p>

            {activeFields.length > 0 && (
                <div className="lfm-utm__cards">
                    {activeFields.map((field) => (
                        <UtmFieldCard
                            key={field.key}
                            field={field}
                            value={filters[field.key] ?? []}
                            onChange={(next) => onChange(field.key, next)}
                            onRemove={() => {
                                onChange(field.key, []);
                                setOpened((prev) =>
                                    prev.filter((k) => k !== field.key),
                                );
                            }}
                        />
                    ))}
                </div>
            )}

            {availableFields.length > 0 && (
                <div className="lfm-field">
                    <div className="lfm-field__head">
                        <span className="lfm-field__label">
                            {activeFields.length > 0
                                ? t("pages.filters.utm_add_another")
                                : t("pages.filters.utm_add")}
                        </span>
                    </div>
                    <div className="lfm-pills">
                        {availableFields.map((field) => (
                            <button
                                key={field.key}
                                type="button"
                                className="lfm-addbtn"
                                onClick={() =>
                                    setOpened((prev) => [...prev, field.key])
                                }
                            >
                                + {field.key}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {reading.length > 0 && (
                <div className="lfm-reading">
                    <div className="lfm-reading__label">{t("pages.filters.utm_reading_as")}</div>
                    <div className="lfm-reading__text">
                        {t("pages.filters.utm_leads_tagged")}{" "}
                        {reading.map((entry, index) => (
                            <React.Fragment key={entry.key}>
                                {index > 0 && ", "}
                                <span className="lfm-reading__key">
                                    {entry.key}
                                </span>{" "}
                                ={" "}
                                <b>
                                    {entry.values.length > 3
                                        ? t("pages.filters.utm_values_n", { n: entry.values.length })
                                        : entry.values.join(` ${t("pages.filters.or_word")} `)}
                                </b>
                            </React.Fragment>
                        ))}
                        .
                    </div>
                </div>
            )}
        </div>
    );
}

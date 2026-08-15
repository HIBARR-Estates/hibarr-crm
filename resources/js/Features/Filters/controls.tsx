import React, { useMemo, useState } from "react";
import { DatePicker, Select } from "antd";
import dayjs from "dayjs";
import { companyDateDayjsFormat } from "@/lib/companyDateTime";
import type { FilterOption } from "@/contexts/FilterContext";

const { RangePicker } = DatePicker;

/** Counts keyed by option value, as returned by LeadFilterFacetsService. */
export type FacetCounts = Record<string, number>;

export const fmt = (n: number) => n.toLocaleString();

const TEMPERATURE_STYLE: Record<
    string,
    { dot: string; border: string; bg: string; text: string; sub: string }
> = {
    hot: {
        dot: "#b91c1c",
        border: "#b91c1c",
        bg: "#fef2f2",
        text: "#b91c1c",
        sub: "#5b6472",
    },
    warm: {
        dot: "#92400e",
        border: "#92400e",
        bg: "#fff7ed",
        text: "#92400e",
        sub: "#5b6472",
    },
    cold: {
        dot: "#1a6bb5",
        border: "#1a6bb5",
        bg: "#e8f1fb",
        text: "#1a6bb5",
        sub: "#5b6472",
    },
};

export function FieldShell({
    label,
    hint,
    action,
    children,
}: {
    label: string;
    hint?: React.ReactNode;
    /** Right-aligned control in the field header (e.g. Clear). */
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="lfm-field">
            <div className="lfm-field__head">
                <span className="lfm-field__label">{label}</span>
                {hint ? <span className="lfm-field__hint">{hint}</span> : null}
                {action ? (
                    <span className="lfm-field__action">{action}</span>
                ) : null}
            </div>
            {children}
        </div>
    );
}

/** Multi-select pill row — the workhorse control (status, source, categories, languages…). */
export function PillGroup({
    options,
    value,
    counts,
    onChange,
    collapseAfter = 12,
}: {
    options: FilterOption[];
    value: any[];
    counts?: FacetCounts;
    onChange: (next: any[]) => void;
    collapseAfter?: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const selected = new Set((value ?? []).map(String));
    const hidden = Math.max(0, options.length - collapseAfter);
    const shown = expanded ? options : options.slice(0, collapseAfter);

    const toggle = (optionValue: any) => {
        const key = String(optionValue);
        const next = selected.has(key)
            ? (value ?? []).filter((v) => String(v) !== key)
            : [...(value ?? []), optionValue];
        onChange(next);
    };

    if (options.length === 0) {
        return <div className="lfm-empty">No options available</div>;
    }

    return (
        <div className="lfm-pills">
            {shown.map((option) => {
                const isOn = selected.has(String(option.value));
                const count = counts?.[String(option.value)];
                return (
                    <button
                        key={String(option.value)}
                        type="button"
                        className={`lfm-pill${isOn ? " is-on" : ""}`}
                        onClick={() => toggle(option.value)}
                    >
                        {option.label}
                        {count != null && (
                            <span className="lfm-pill__count">{fmt(count)}</span>
                        )}
                    </button>
                );
            })}
            {hidden > 0 && !expanded && (
                <button
                    type="button"
                    className="lfm-pill lfm-pill--ghost"
                    onClick={() => setExpanded(true)}
                >
                    +{hidden} more
                </button>
            )}
        </div>
    );
}

/** The three temperature cards from 1a. */
export function TemperatureCards({
    options,
    value,
    counts,
    onChange,
}: {
    options: FilterOption[];
    value: any[];
    counts?: FacetCounts;
    onChange: (next: any[]) => void;
}) {
    const selected = new Set((value ?? []).map(String));

    return (
        <div className="lfm-temp">
            {options.map((option) => {
                const key = String(option.value);
                const style = TEMPERATURE_STYLE[key] ?? TEMPERATURE_STYLE.cold;
                const isOn = selected.has(key);
                const count = counts?.[key];
                return (
                    <button
                        key={key}
                        type="button"
                        className="lfm-temp__card"
                        style={
                            isOn
                                ? {
                                      borderColor: style.border,
                                      borderWidth: 1.5,
                                      background: style.bg,
                                  }
                                : undefined
                        }
                        onClick={() =>
                            onChange(
                                isOn
                                    ? (value ?? []).filter(
                                          (v) => String(v) !== key,
                                      )
                                    : [...(value ?? []), option.value],
                            )
                        }
                    >
                        <span className="lfm-temp__top">
                            <span
                                className="lfm-temp__dot"
                                style={{ background: style.dot }}
                            />
                            <span
                                className="lfm-temp__name"
                                style={isOn ? { color: style.text } : undefined}
                            >
                                {option.label}
                            </span>
                        </span>
                        <span
                            className="lfm-temp__count"
                            style={isOn ? { color: style.sub } : undefined}
                        >
                            {count != null ? `${fmt(count)} leads` : " "}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** Any / Yes / No tri-state used by the engagement flags. */
export function Segmented({
    value,
    onChange,
    options,
}: {
    value: any;
    onChange: (next: any) => void;
    options: FilterOption[];
}) {
    const items = [{ value: "", label: "Any" }, ...options];
    const current = value == null || value === "" ? "" : String(value);

    return (
        <div className="lfm-seg">
            {items.map((item) => {
                const isOn = current === String(item.value);
                return (
                    <button
                        key={String(item.value)}
                        type="button"
                        className={`lfm-seg__item${isOn ? " is-on" : ""}`}
                        onClick={() =>
                            onChange(item.value === "" ? null : item.value)
                        }
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

/** Searchable checkbox list with avatars — lead owner / added by. */
export function CheckList({
    options,
    value,
    counts,
    onChange,
    searchPlaceholder = "Search…",
}: {
    options: FilterOption[];
    value: any[];
    counts?: FacetCounts;
    onChange: (next: any[]) => void;
    searchPlaceholder?: string;
}) {
    const [query, setQuery] = useState("");
    const selected = new Set((value ?? []).map(String));

    const visible = useMemo(() => {
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

    const selectedOptions = options.filter((option) =>
        selected.has(String(option.value)),
    );

    return (
        <div>
            <div className="lfm-checklist">
                <input
                    className="lfm-checklist__search"
                    value={query}
                    placeholder={searchPlaceholder}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <div className="lfm-checklist__body">
                    {visible.length === 0 && (
                        <div className="lfm-empty lfm-empty--pad">
                            No matches
                        </div>
                    )}
                    {visible.map((option) => {
                        const key = String(option.value);
                        const isOn = selected.has(key);
                        const count = counts?.[key];
                        return (
                            <button
                                key={key}
                                type="button"
                                className={`lfm-checklist__row${isOn ? " is-on" : ""}`}
                                onClick={() => toggle(option.value)}
                            >
                                <span
                                    className={`lfm-check${isOn ? " is-on" : ""}`}
                                >
                                    {isOn ? "✓" : ""}
                                </span>
                                <span className="lfm-avatar">
                                    {initialsOf(String(option.label))}
                                </span>
                                <span className="lfm-checklist__name">
                                    {option.label}
                                </span>
                                {count != null && (
                                    <span className="lfm-checklist__count">
                                        {fmt(count)}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
            {selectedOptions.length > 0 && (
                <div className="lfm-selected-pills">
                    {selectedOptions.map((option) => (
                        <span key={String(option.value)} className="lfm-tray__chip">
                            {option.label}
                            <button
                                type="button"
                                className="lfm-tray__x"
                                aria-label={`Remove ${option.label}`}
                                onClick={() => toggle(option.value)}
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Token/tag entry for long option lists (countries, nationalities). */
export function TokenSelect({
    options,
    value,
    onChange,
    placeholder,
}: {
    options: FilterOption[];
    value: any[];
    onChange: (next: any[]) => void;
    placeholder?: string;
}) {
    return (
        <Select
            mode="multiple"
            className="lfm-tokens"
            value={value ?? []}
            onChange={onChange}
            placeholder={placeholder || "Type to add…"}
            options={options.map((option) => ({
                value: option.value,
                label: option.label,
            }))}
            optionFilterProp="label"
            allowClear
            style={{ width: "100%" }}
        />
    );
}

const DATE_PRESETS: Array<{ key: string; label: string; days: number }> = [
    { key: "today", label: "Today", days: 0 },
    { key: "7", label: "7 days", days: 7 },
    { key: "30", label: "30 days", days: 30 },
    { key: "quarter", label: "Quarter", days: 90 },
];

/** Quick presets + explicit range, writing the existing *_start/_end keys. */
export function DatePresets({
    start,
    end,
    onChange,
}: {
    start?: string | null;
    end?: string | null;
    onChange: (start: string | null, end: string | null) => void;
}) {
    const activePreset = useMemo(() => {
        if (!start || !end) return null;
        const today = dayjs().format("YYYY-MM-DD");
        if (end !== today) return null;
        const match = DATE_PRESETS.find(
            (preset) =>
                dayjs().subtract(preset.days, "day").format("YYYY-MM-DD") ===
                start,
        );
        return match?.key ?? null;
    }, [start, end]);

    return (
        <div className="lfm-dates">
            {DATE_PRESETS.map((preset) => (
                <button
                    key={preset.key}
                    type="button"
                    className={`lfm-chipbtn${
                        activePreset === preset.key ? " is-on" : ""
                    }`}
                    onClick={() =>
                        onChange(
                            dayjs()
                                .subtract(preset.days, "day")
                                .format("YYYY-MM-DD"),
                            dayjs().format("YYYY-MM-DD"),
                        )
                    }
                >
                    {preset.label}
                </button>
            ))}
            <span className="lfm-dates__sep" />
            <RangePicker
                value={[
                    start ? dayjs(start) : null,
                    end ? dayjs(end) : null,
                ]}
                onChange={(dates) =>
                    onChange(
                        dates?.[0] ? dates[0].format("YYYY-MM-DD") : null,
                        dates?.[1] ? dates[1].format("YYYY-MM-DD") : null,
                    )
                }
                format={companyDateDayjsFormat()}
                allowEmpty={[true, true]}
            />
        </div>
    );
}

/** Min/max numeric range (contact score). */
export function ScoreRange({
    min,
    max,
    onChange,
}: {
    min?: number | null;
    max?: number | null;
    onChange: (min: number | null, max: number | null) => void;
}) {
    const parse = (raw: string) => {
        if (raw.trim() === "") return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    };

    return (
        <div className="lfm-range">
            <input
                type="number"
                className="lfm-range__input"
                placeholder="Min"
                value={min ?? ""}
                onChange={(event) =>
                    onChange(parse(event.target.value), max ?? null)
                }
            />
            <span className="lfm-range__dash">—</span>
            <input
                type="number"
                className="lfm-range__input"
                placeholder="Max"
                value={max ?? ""}
                onChange={(event) =>
                    onChange(min ?? null, parse(event.target.value))
                }
            />
        </div>
    );
}

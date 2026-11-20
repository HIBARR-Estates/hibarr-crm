import React, { useCallback, useMemo, useRef, useState } from "react";
import { Modal, message } from "antd";
import { router, usePage } from "@inertiajs/react";
import {
    activeModeOf,
    isValuelessMode,
    modeKeyOf,
    useFilter,
    valueKeysOf,
    withoutIdleModes,
    type ExclusionMode,
    type FilterConfig,
    type FilterFieldConfig,
    type FilterOption,
} from "@/contexts/FilterContext";
import {
    CheckList,
    DatePresets,
    FieldShell,
    ModeSwitch,
    PillGroup,
    ScoreRange,
    Segmented,
    SingleSelect,
    TemperatureCards,
    TokenSelect,
    fmt,
    type FacetCounts,
} from "./controls";
import UtmSection from "./UtmSection";
import SaveViewPopover from "./SaveViewPopover";
import ViewsBar from "./ViewsBar";
import SavedViewsDrawer from "./SavedViewsDrawer";
import { describeFilters, suggestViewName } from "./filterSummary";
import useLeadSavedViews, {
    type LeadSavedView,
    type SavedViewEntity,
} from "./useLeadSavedViews";
import "./entity-filter-modal.css";
import { useTranslation } from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

const UTM_SECTION = "Campaign (UTM)";

interface EntityFilterModalProps {
    config: FilterConfig;
    optionsLoading?: boolean;
    /** Plural noun for the copy, e.g. "leads" / "deals". */
    entityLabel?: string;
    /** Rows currently listed (footer estimate). */
    currentCount?: number;
    /** Saved views bar — only rendered for entities that support it. */
    savedViews?: boolean;
    /** Which saved-view route group the bar reads and writes. */
    savedViewEntity?: SavedViewEntity;
}

/** Exactly what the backend will read back as query params: no blanks. */
function storableFilters(filters: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
        Object.entries(filters).filter(
            ([, value]) =>
                value != null &&
                value !== "" &&
                !(Array.isArray(value) && value.length === 0),
        ),
    );
}

function optionsOf(field: FilterFieldConfig): FilterOption[] {
    const options =
        typeof field.options === "function" ? field.options() : field.options;
    return options ?? [];
}

function normalizeQuery(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/**
 * Narrow one field to a search query. A query that names the field (or its
 * section) keeps every option; otherwise only the options whose label matches
 * stay, and a field with no matching option drops out. Options the draft has
 * already selected are kept, so a search never hides what is being applied.
 */
function searchField(
    field: FilterFieldConfig,
    query: string,
    sectionMatches: boolean,
    selected: unknown,
): FilterFieldConfig | null {
    if (!query || sectionMatches) return field;
    if (normalizeQuery(field.label).includes(query)) return field;

    const options = optionsOf(field);
    if (options.length === 0) return null;

    const selectedValues = new Set(
        (Array.isArray(selected) ? selected : selected != null ? [selected] : []).map(
            (value) => String(value),
        ),
    );
    const matching = options.filter(
        (option) =>
            normalizeQuery(String(option.label ?? option.value)).includes(query) ||
            selectedValues.has(String(option.value)),
    );
    const anyMatch = matching.some(
        (option) => !selectedValues.has(String(option.value)),
    );
    if (!anyMatch) return null;

    // Segmented and temperature controls are a fixed, short set: show it whole.
    if (field.control === "segmented" || field.control === "temperature") {
        return field;
    }

    return { ...field, options: matching };
}

/** Date-range fields write two keys; leads' created range keeps the legacy pair. */
function rangeKeysOf(field: FilterFieldConfig): [string, string] {
    return field.rangeKeys ?? ["start_date", "end_date"];
}

/**
 * Two-pane filter workbench — mockups 1a, 2a (UTM), 2b/2c (saved views).
 * Shared by Leads, Deals and Tasks: everything entity-specific comes from the
 * FilterConfig. State still flows through FilterContext, so the URL contract
 * and the backend query params are unchanged.
 */
export default function EntityFilterModal({
    config,
    optionsLoading = false,
    entityLabel = "leads",
    currentCount,
    savedViews: savedViewsEnabled = true,
    savedViewEntity = "lead",
}: EntityFilterModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { isDrawerOpen, closeDrawer, draftFilters, setFilter, applyFilters } =
        useFilter();
    const { props } = usePage<any>();

    const facets = (props.filterFacets ?? {}) as Record<string, any>;
    const savedViews = (props.savedViews ?? []) as LeadSavedView[];
    const totalRows = facets.total as number | undefined;

    const { saving, createView, updateView, deleteView } =
        useLeadSavedViews(savedViewEntity);
    const [savePopoverOpen, setSavePopoverOpen] = useState(false);
    const [viewsDrawerOpen, setViewsDrawerOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<LeadSavedView | null>(
        null,
    );
    const [activeViewId, setActiveViewId] = useState<number | null>(null);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const paneRef = useRef<HTMLDivElement | null>(null);
    const [searchText, setSearchText] = useState("");
    const query = normalizeQuery(searchText);

    // Sections in declaration order, minus anything excluded/hidden.
    const sections = useMemo(() => {
        const grouped = new Map<string, FilterFieldConfig[]>();
        for (const field of config.fields) {
            if (field.hidden) continue;
            if (config.excludeFields?.includes(field.key)) continue;
            const section = field.section ?? "General";
            if (!grouped.has(section)) grouped.set(section, []);
            grouped.get(section)!.push(field);
        }
        return Array.from(grouped.entries()).map(([name, fields]) => ({
            name,
            fields,
        }));
    }, [config]);

    /** Sections and fields narrowed to the search box (all of them when empty). */
    const visibleSections = useMemo(() => {
        if (!query) return sections;
        return sections
            .map((section) => {
                const sectionMatches = normalizeQuery(section.name).includes(query);
                const fields = section.fields
                    .map((field) =>
                        searchField(
                            field,
                            query,
                            sectionMatches,
                            draftFilters[field.key],
                        ),
                    )
                    .filter((field): field is FilterFieldConfig => field !== null);
                return { name: section.name, fields };
            })
            .filter((section) => section.fields.length > 0);
    }, [sections, query, draftFilters]);

    const visibleFieldCount = useMemo(
        () =>
            visibleSections.reduce(
                (total, section) => total + section.fields.length,
                0,
            ),
        [visibleSections],
    );

    const parts = useMemo(
        () => describeFilters(config, draftFilters, { t, td }),
        [config, draftFilters, t, td],
    );

    /** Whether a field has a value of its own, apart from its mode. */
    const hasDraftValue = (field: FilterFieldConfig) => {
        return valueKeysOf(field).some((key) => {
            const value = draftFilters[key];
            return (
                value != null &&
                value !== "" &&
                !(Array.isArray(value) && value.length === 0)
            );
        });
    };

    /** Active-filter count per section, for the rail badges. */
    const sectionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const section of sections) {
            counts[section.name] = section.fields.reduce((total, field) => {
                // "Is empty" / "Has any" filter with no value of their own. "Is not"
                // with nothing picked filters nothing, so it does not count.
                if (
                    isValuelessMode(activeModeOf(field, draftFilters)) &&
                    !hasDraftValue(field)
                ) {
                    return total + 1;
                }
                if (field.control === "datePresets") {
                    const [startKey, endKey] = rangeKeysOf(field);
                    return (
                        total +
                        (draftFilters[startKey] || draftFilters[endKey] ? 1 : 0)
                    );
                }
                if (field.control === "scoreRange") {
                    return (
                        total +
                        (draftFilters[`min_${field.key}`] != null ||
                        draftFilters[`max_${field.key}`] != null
                            ? 1
                            : 0)
                    );
                }
                const value = draftFilters[field.key];
                const filled =
                    value != null &&
                    value !== "" &&
                    !(Array.isArray(value) && value.length === 0);
                return total + (filled ? 1 : 0);
            }, 0);
        }
        return counts;
    }, [sections, draftFilters]);

    const activeFilterCount = parts.length;
    const entity = td(entityLabel, { source: "en" });

    const clearDraft = useCallback(() => {
        for (const field of config.fields) {
            setFilter(field.key, null);
            if (field.exclusions?.length) {
                setFilter(modeKeyOf(field.key), null);
            }
            if (field.control === "datePresets") {
                rangeKeysOf(field).forEach((key) => setFilter(key, null));
            }
            if (field.control === "scoreRange") {
                setFilter(`min_${field.key}`, null);
                setFilter(`max_${field.key}`, null);
            }
        }
        setActiveViewId(null);
    }, [config.fields, setFilter]);

    const scrollToSection = (name: string) => {
        setActiveSection(name);
        const node = paneRef.current?.querySelector<HTMLElement>(
            `[data-section="${CSS.escape(name)}"]`,
        );
        node?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const applyView = (view: LeadSavedView) => {
        clearDraft();
        // A view saved before idle modes were dropped may still carry one.
        for (const [key, value] of Object.entries(
            withoutIdleModes(config, view.filters ?? {}),
        )) {
            setFilter(key, value);
        }
        setActiveViewId(view.id);
    };

    const handleSaveView = async (payload: {
        name: string;
        visibility: "private" | "team";
        pinned: boolean;
    }) => {
        // Renaming changes the name, pin and sharing only. A view's filters are
        // replaced on purpose, from the drawer ("Update with current filters"),
        // never as a side effect of a rename: for an admin on a team view that
        // would silently overwrite what the whole team has saved.
        const result = renameTarget
            ? await updateView(renameTarget.id, payload)
            : // Persist exactly what the backend will read back as query params.
              await createView({
                  ...payload,
                  filters: storableFilters(
                      withoutIdleModes(config, draftFilters),
                  ),
              });

        if (result) {
            message.success(
                payload.visibility === "team"
                    ? t("pages.filters.view_saved_team")
                    : t("pages.filters.view_saved"),
            );
            if (typeof result !== "boolean") setActiveViewId(result.id);
            setSavePopoverOpen(false);
            setRenameTarget(null);
        }
    };

    const renderFieldControl = (
        field: FilterFieldConfig,
        modeSwitch?: React.ReactNode,
    ) => {
        const value = draftFilters[field.key];
        const counts = (field.facetKey ? facets[field.facetKey] : undefined) as
            FacetCounts | undefined;
        const options = optionsOf(field);

        const set = (next: any) => setFilter(field.key, next, field.label);

        switch (field.control) {
            case "temperature":
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        action={modeSwitch}
                        hint={
                            value?.length
                                ? t("pages.filters.selected_n", { n: value.length })
                                : undefined
                        }
                    >
                        <TemperatureCards
                            options={options}
                            value={value ?? []}
                            counts={counts}
                            onChange={set}
                        />
                    </FieldShell>
                );

            case "segmented":
                return (
                    <div className="lfm-flagrow" key={field.key}>
                        <span className="lfm-flagrow__label">
                            {td(field.label, { source: "en" })}
                        </span>
                        <Segmented
                            options={options}
                            value={value}
                            onChange={set}
                        />
                    </div>
                );

            case "checklist":
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        action={modeSwitch}
                        hint={
                            value?.length
                                ? t("pages.filters.selected_n", { n: value.length })
                                : undefined
                        }
                    >
                        <CheckList
                            options={options}
                            value={value ?? []}
                            counts={counts}
                            onChange={set}
                            searchPlaceholder={
                                field.placeholder
                                    ? td(field.placeholder, { source: "en" })
                                    : undefined
                            }
                        />
                    </FieldShell>
                );

            case "tokens":
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        action={modeSwitch}
                    >
                        <TokenSelect
                            options={options}
                            value={value ?? []}
                            onChange={set}
                            placeholder={
                                field.placeholder
                                    ? td(field.placeholder, { source: "en" })
                                    : undefined
                            }
                        />
                    </FieldShell>
                );

            case "select":
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        action={modeSwitch}
                    >
                        <SingleSelect
                            options={options}
                            value={value ?? null}
                            onChange={set}
                            placeholder={
                                field.placeholder
                                    ? td(field.placeholder, { source: "en" })
                                    : undefined
                            }
                        />
                    </FieldShell>
                );

            case "datePresets": {
                const [startKey, endKey] = rangeKeysOf(field);
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        action={modeSwitch}
                    >
                        <DatePresets
                            start={draftFilters[startKey]}
                            end={draftFilters[endKey]}
                            onChange={(start, end) => {
                                setFilter(
                                    startKey,
                                    start,
                                    t("pages.filters.label_from", { label: td(field.label, { source: "en" }) }),
                                );
                                setFilter(endKey, end, t("pages.filters.label_to", { label: td(field.label, { source: "en" }) }));
                            }}
                        />
                    </FieldShell>
                );
            }

            case "scoreRange":
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        action={modeSwitch}
                    >
                        <ScoreRange
                            min={draftFilters[`min_${field.key}`]}
                            max={draftFilters[`max_${field.key}`]}
                            onChange={(min, max) => {
                                setFilter(
                                    `min_${field.key}`,
                                    min,
                                    t("pages.filters.label_min", { label: td(field.label, { source: "en" }) }),
                                );
                                setFilter(
                                    `max_${field.key}`,
                                    max,
                                    t("pages.filters.label_max", { label: td(field.label, { source: "en" }) }),
                                );
                            }}
                        />
                    </FieldShell>
                );

            case "pills":
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        action={modeSwitch}
                        hint={
                            value?.length
                                ? t("pages.filters.selected_n", { n: value.length })
                                : undefined
                        }
                    >
                        <PillGroup
                            options={options}
                            value={value ?? []}
                            counts={counts}
                            onChange={set}
                        />
                    </FieldShell>
                );

            default:
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        action={modeSwitch}
                    >
                        <input
                            className="lfm-text"
                            value={value ?? ""}
                            placeholder={
                                field.placeholder
                                    ? td(field.placeholder, { source: "en" })
                                    : undefined
                            }
                            onChange={(event) =>
                                set(event.target.value || null)
                            }
                        />
                    </FieldShell>
                );
        }
    };

    /**
     * One field: its control, plus the "is one of / is not / is empty / has
     * any" switch when the field offers exclusions. Empty and Has any need no
     * values, so the control gives way to a one-line explanation.
     */
    const renderField = (field: FilterFieldConfig) => {
        if (!field.exclusions?.length) return renderFieldControl(field);

        const mode = activeModeOf(field, draftFilters);
        const subject = td(field.sentence ?? field.label, { source: "en" }).toLowerCase();

        const setMode = (next: ExclusionMode | null) => {
            setFilter(modeKeyOf(field.key), next);
            if (isValuelessMode(next)) {
                // These modes ignore values: don't leave a hidden selection behind.
                setFilter(field.key, null);
                valueKeysOf(field).forEach((key) => setFilter(key, null));
            }
        };

        const modeSwitch = (
            <ModeSwitch
                modes={field.exclusions}
                value={mode}
                labels={field.exclusionLabels}
                onChange={setMode}
                label={t("pages.filters.mode_aria", {
                    field: td(field.label, { source: "en" }),
                })}
            />
        );

        if (isValuelessMode(mode)) {
            return (
                <FieldShell
                    key={field.key}
                    label={field.label}
                    action={modeSwitch}
                >
                    <p className="lfm-modenote">
                        {t(`pages.filters.mode_note_${mode}`, { entity, field: subject })}
                    </p>
                </FieldShell>
            );
        }

        return (
            <div className="lfm-fieldwrap" key={field.key}>
                {renderFieldControl(field, modeSwitch)}
                {mode === "not_in" && (
                    <p className="lfm-modenote lfm-modenote--tight">
                        {t("pages.filters.mode_note_not_in", { entity, field: subject })}
                    </p>
                )}
            </div>
        );
    };

    const utmFields = useMemo(
        () =>
            visibleSections.find((section) => section.name === UTM_SECTION)
                ?.fields ?? [],
        [visibleSections],
    );

    return (
        <Modal
            open={isDrawerOpen}
            onCancel={closeDrawer}
            width={980}
            footer={null}
            closable={false}
            centered
            destroyOnClose
            className="lfm-modal"
        >
            <div className="lfm">
                <header className="lfm-header">
                    <div>
                        <h2 className="lfm-header__title">
                            {t("pages.filters.modal_title", { entity })}
                        </h2>
                        <p className="lfm-header__sub">
                            {totalRows != null
                                ? t("pages.filters.modal_sub_total", {
                                      total: fmt(totalRows),
                                      entity,
                                  })
                                : t("pages.filters.modal_sub", { entity })}
                        </p>
                    </div>
                    <div className="lfm-header__actions">
                        <label className="lfm-search">
                            <svg
                                className="lfm-search__icon"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.5-3.5" />
                            </svg>
                            <input
                                type="search"
                                className="lfm-search__input"
                                value={searchText}
                                onChange={(event) => {
                                    setSearchText(event.target.value);
                                    paneRef.current?.scrollTo({ top: 0 });
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Escape" && searchText) {
                                        event.stopPropagation();
                                        setSearchText("");
                                    }
                                }}
                                placeholder={t("pages.filters.search_filters_placeholder")}
                                aria-label={t("pages.filters.search_filters_aria")}
                                autoFocus
                            />
                            {searchText && (
                                <button
                                    type="button"
                                    className="lfm-search__clear"
                                    onClick={() => setSearchText("")}
                                    aria-label={t("pages.filters.clear_search")}
                                >
                                    ✕
                                </button>
                            )}
                        </label>
                        <button
                            type="button"
                            className="lfm-btn"
                            onClick={clearDraft}
                            disabled={activeFilterCount === 0}
                        >
                            {t("pages.filters.reset")}
                        </button>
                        <button
                            type="button"
                            className="lfm-iconbtn"
                            onClick={closeDrawer}
                            aria-label={t("pages.filters.close")}
                        >
                            ✕
                        </button>
                    </div>
                </header>

                {savedViewsEnabled && (
                    <ViewsBar
                        views={savedViews}
                        activeViewId={activeViewId}
                        dirty={activeViewId == null}
                        hasFilters={activeFilterCount > 0}
                        onApplyView={applyView}
                        onSaveCurrent={() => {
                            setRenameTarget(null);
                            setSavePopoverOpen(true);
                        }}
                        onRename={(view) => {
                            setRenameTarget(view);
                            setSavePopoverOpen(true);
                        }}
                        onDelete={(view) => {
                            void deleteView(view.id);
                            if (activeViewId === view.id) setActiveViewId(null);
                        }}
                        onManage={() => setViewsDrawerOpen(true)}
                    />
                )}

                <div className="lfm-body">
                    <nav className="lfm-rail">
                        {visibleSections.map((section) => (
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
                                <span>{td(section.name, { source: "en" })}</span>
                                {sectionCounts[section.name] > 0 && (
                                    <span className="lfm-rail__badge">
                                        {sectionCounts[section.name]}
                                    </span>
                                )}
                            </button>
                        ))}
                        <div className="lfm-rail__spacer" />
                        <div className="lfm-estimate">
                            <div className="lfm-estimate__label">
                                {t("pages.filters.current_list")}
                            </div>
                            <div className="lfm-estimate__value">
                                {currentCount != null
                                    ? t("pages.filters.entity_count", { n: fmt(currentCount), entity })
                                    : "—"}
                            </div>
                            <div className="lfm-estimate__sub">
                                {totalRows != null
                                    ? t("pages.filters.of_total_updates", {
                                          total: fmt(totalRows),
                                      })
                                    : t("pages.filters.updates_on_apply")}
                            </div>
                        </div>
                    </nav>

                    <div className="lfm-pane" ref={paneRef}>
                        {optionsLoading && (
                            <div className="lfm-loading">
                                {t("pages.filters.loading_options")}
                            </div>
                        )}
                        {query && (
                            <div className="lfm-search-summary" role="status">
                                {visibleFieldCount === 0
                                    ? t("pages.filters.no_filters_match", {
                                          query: searchText.trim(),
                                      })
                                    : t("pages.filters.filters_match", {
                                          count: visibleFieldCount,
                                          query: searchText.trim(),
                                      })}
                                {visibleFieldCount === 0 && (
                                    <button
                                        type="button"
                                        className="lfm-search-summary__reset"
                                        onClick={() => setSearchText("")}
                                    >
                                        {t("pages.filters.show_all_filters")}
                                    </button>
                                )}
                            </div>
                        )}
                        {visibleSections.map((section, index) => (
                            <section
                                key={section.name}
                                data-section={section.name}
                                className="lfm-section"
                            >
                                {index > 0 && <div className="lfm-divider" />}
                                <h3 className="lfm-section__title">
                                    {td(section.name, { source: "en" })}
                                </h3>
                                {section.name === UTM_SECTION ? (
                                    <UtmSection
                                        fields={utmFields}
                                        filters={draftFilters}
                                        onChange={(key, next) =>
                                            setFilter(key, next)
                                        }
                                    />
                                ) : (
                                    <div className="lfm-section__fields">
                                        {section.fields.map(renderField)}
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                </div>

                <footer className="lfm-footer">
                    <div className="lfm-tray">
                        {parts.map((part) => (
                            <span
                                key={part.keys.join("|")}
                                className="lfm-tray__chip"
                            >
                                {part.chip}
                                <button
                                    type="button"
                                    className="lfm-tray__x"
                                    aria-label={t("pages.filters.remove_filter", { label: part.label })}
                                    onClick={() => {
                                        part.keys.forEach((key) =>
                                            setFilter(key, null),
                                        );
                                        setActiveViewId(null);
                                    }}
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                        {parts.length === 0 && (
                            <span className="lfm-tray__empty">
                                {t("pages.filters.no_filters_yet")}
                            </span>
                        )}
                    </div>
                    <div className="lfm-footer__actions">
                        {savedViewsEnabled && (
                            <button
                                type="button"
                                className="lfm-btn"
                                onClick={() => {
                                    setRenameTarget(null);
                                    setSavePopoverOpen(true);
                                }}
                                disabled={activeFilterCount === 0}
                            >
                                {t("pages.filters.save_as_view")}
                            </button>
                        )}
                        <button
                            type="button"
                            className="lfm-btn lfm-btn--primary"
                            onClick={applyFilters}
                        >
                            {t("pages.filters.apply_filters")}
                        </button>
                    </div>

                    <SavedViewsDrawer
                        open={viewsDrawerOpen}
                        views={savedViews}
                        config={config}
                        activeViewId={activeViewId}
                        saving={saving}
                        currentFilters={storableFilters(
                            withoutIdleModes(config, draftFilters),
                        )}
                        onClose={() => setViewsDrawerOpen(false)}
                        onApply={(view) => {
                            applyView(view);
                            setViewsDrawerOpen(false);
                        }}
                        onUpdate={updateView}
                        onDelete={async (id) => {
                            const ok = await deleteView(id);
                            if (ok && activeViewId === id) setActiveViewId(null);
                            return ok;
                        }}
                    />

                    <SaveViewPopover
                        open={savePopoverOpen}
                        parts={parts}
                        suggestedName={suggestViewName(parts, { t, td })}
                        saving={saving}
                        existing={renameTarget}
                        onCancel={() => {
                            setSavePopoverOpen(false);
                            setRenameTarget(null);
                        }}
                        onSave={handleSaveView}
                    />
                </footer>
            </div>
        </Modal>
    );
}

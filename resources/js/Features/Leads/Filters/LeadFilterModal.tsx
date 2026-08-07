import React, { useCallback, useMemo, useRef, useState } from "react";
import { Modal, message } from "antd";
import { router, usePage } from "@inertiajs/react";
import {
    useFilter,
    type FilterConfig,
    type FilterFieldConfig,
    type FilterOption,
} from "@/contexts/FilterContext";
import {
    CheckList,
    DatePresets,
    FieldShell,
    PillGroup,
    ScoreRange,
    Segmented,
    TemperatureCards,
    TokenSelect,
    fmt,
    type FacetCounts,
} from "./controls";
import UtmSection from "./UtmSection";
import SaveViewPopover from "./SaveViewPopover";
import ViewsBar from "./ViewsBar";
import { describeFilters, suggestViewName } from "./filterSummary";
import useLeadSavedViews, { type LeadSavedView } from "./useLeadSavedViews";
import "./lead-filter-modal.css";

const UTM_SECTION = "Campaign (UTM)";

interface LeadFilterModalProps {
    config: FilterConfig;
    optionsLoading?: boolean;
}

function optionsOf(field: FilterFieldConfig): FilterOption[] {
    const options =
        typeof field.options === "function" ? field.options() : field.options;
    return options ?? [];
}

/**
 * Redesigned Leads filter modal — mockups 1a (two-pane workbench), 2a (UTM),
 * 2b/2c (saved views). State still flows through FilterContext, so the URL
 * contract and the backend query params are unchanged.
 */
export default function LeadFilterModal({
    config,
    optionsLoading = false,
}: LeadFilterModalProps) {
    const {
        isDrawerOpen,
        closeDrawer,
        draftFilters,
        setFilter,
        applyFilters,
    } = useFilter();
    const { props } = usePage<any>();

    const facets = (props.filterFacets ?? {}) as Record<string, any>;
    const savedViews = (props.savedViews ?? []) as LeadSavedView[];
    const totalLeads = facets.total as number | undefined;
    const currentCount = props.leads?.total as number | undefined;

    const { saving, createView, updateView, deleteView } = useLeadSavedViews();
    const [savePopoverOpen, setSavePopoverOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<LeadSavedView | null>(null);
    const [activeViewId, setActiveViewId] = useState<number | null>(null);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const paneRef = useRef<HTMLDivElement | null>(null);

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

    const parts = useMemo(
        () => describeFilters(config, draftFilters),
        [config, draftFilters],
    );

    /** Active-filter count per section, for the rail badges. */
    const sectionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const section of sections) {
            counts[section.name] = section.fields.reduce((total, field) => {
                if (field.control === "datePresets") {
                    return (
                        total +
                        (draftFilters.start_date || draftFilters.end_date
                            ? 1
                            : 0)
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

    const clearDraft = useCallback(() => {
        for (const field of config.fields) {
            setFilter(field.key, null);
            if (field.control === "datePresets") {
                setFilter("start_date", null);
                setFilter("end_date", null);
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
        for (const [key, value] of Object.entries(view.filters ?? {})) {
            setFilter(key, value);
        }
        setActiveViewId(view.id);
    };

    const handleSaveView = async (payload: {
        name: string;
        visibility: "private" | "team";
        pinned: boolean;
    }) => {
        // Persist exactly what the backend will read back as query params.
        const filters = Object.fromEntries(
            Object.entries(draftFilters).filter(
                ([, value]) =>
                    value != null &&
                    value !== "" &&
                    !(Array.isArray(value) && value.length === 0),
            ),
        );

        const result = renameTarget
            ? await updateView(renameTarget.id, { ...payload, filters })
            : await createView({ ...payload, filters });

        if (result) {
            message.success(
                payload.visibility === "team"
                    ? `View saved and shared with your team.`
                    : `View saved.`,
            );
            if (typeof result !== "boolean") setActiveViewId(result.id);
            setSavePopoverOpen(false);
            setRenameTarget(null);
        }
    };

    const renderField = (field: FilterFieldConfig) => {
        const value = draftFilters[field.key];
        const counts = (field.facetKey
            ? facets[field.facetKey]
            : undefined) as FacetCounts | undefined;
        const options = optionsOf(field);

        const set = (next: any) => setFilter(field.key, next, field.label);

        switch (field.control) {
            case "temperature":
                return (
                    <FieldShell
                        key={field.key}
                        label={field.label}
                        hint={
                            value?.length
                                ? `${value.length} selected`
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
                            {field.label}
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
                        hint={
                            value?.length
                                ? `${value.length} selected`
                                : undefined
                        }
                    >
                        <CheckList
                            options={options}
                            value={value ?? []}
                            counts={counts}
                            onChange={set}
                            searchPlaceholder={field.placeholder}
                        />
                    </FieldShell>
                );

            case "tokens":
                return (
                    <FieldShell key={field.key} label={field.label}>
                        <TokenSelect
                            options={options}
                            value={value ?? []}
                            onChange={set}
                            placeholder={field.placeholder}
                        />
                    </FieldShell>
                );

            case "datePresets":
                return (
                    <FieldShell key={field.key} label={field.label}>
                        <DatePresets
                            start={draftFilters.start_date}
                            end={draftFilters.end_date}
                            onChange={(start, end) => {
                                setFilter("start_date", start, "Created from");
                                setFilter("end_date", end, "Created to");
                            }}
                        />
                    </FieldShell>
                );

            case "scoreRange":
                return (
                    <FieldShell key={field.key} label={field.label}>
                        <ScoreRange
                            min={draftFilters[`min_${field.key}`]}
                            max={draftFilters[`max_${field.key}`]}
                            onChange={(min, max) => {
                                setFilter(
                                    `min_${field.key}`,
                                    min,
                                    `Min ${field.label}`,
                                );
                                setFilter(
                                    `max_${field.key}`,
                                    max,
                                    `Max ${field.label}`,
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
                        hint={
                            value?.length
                                ? `${value.length} selected`
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
                    <FieldShell key={field.key} label={field.label}>
                        <input
                            className="lfm-text"
                            value={value ?? ""}
                            placeholder={field.placeholder}
                            onChange={(event) =>
                                set(event.target.value || null)
                            }
                        />
                    </FieldShell>
                );
        }
    };

    const utmFields = useMemo(
        () =>
            config.fields.filter((field) => field.section === UTM_SECTION),
        [config.fields],
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
                        <h2 className="lfm-header__title">Filter leads</h2>
                        <p className="lfm-header__sub">
                            {totalLeads != null
                                ? `Narrow ${fmt(totalLeads)} leads down to the list you want to work today.`
                                : "Narrow your leads down to the list you want to work today."}
                        </p>
                    </div>
                    <div className="lfm-header__actions">
                        <button
                            type="button"
                            className="lfm-btn"
                            onClick={clearDraft}
                            disabled={activeFilterCount === 0}
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            className="lfm-iconbtn"
                            onClick={closeDrawer}
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                </header>

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
                />

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
                                <span>{section.name}</span>
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
                                Current list
                            </div>
                            <div className="lfm-estimate__value">
                                {currentCount != null
                                    ? `${fmt(currentCount)} leads`
                                    : "—"}
                            </div>
                            <div className="lfm-estimate__sub">
                                {totalLeads != null
                                    ? `of ${fmt(totalLeads)} · updates on Apply`
                                    : "updates on Apply"}
                            </div>
                        </div>
                    </nav>

                    <div className="lfm-pane" ref={paneRef}>
                        {optionsLoading && (
                            <div className="lfm-loading">
                                Loading filter options…
                            </div>
                        )}
                        {sections.map((section, index) => (
                            <section
                                key={section.name}
                                data-section={section.name}
                                className="lfm-section"
                            >
                                {index > 0 && <div className="lfm-divider" />}
                                <h3 className="lfm-section__title">
                                    {section.name}
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
                                    aria-label={`Remove ${part.label} filter`}
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
                                No filters yet — everything below is optional.
                            </span>
                        )}
                    </div>
                    <div className="lfm-footer__actions">
                        <button
                            type="button"
                            className="lfm-btn"
                            onClick={() => {
                                setRenameTarget(null);
                                setSavePopoverOpen(true);
                            }}
                            disabled={activeFilterCount === 0}
                        >
                            Save as view
                        </button>
                        <button
                            type="button"
                            className="lfm-btn lfm-btn--primary"
                            onClick={applyFilters}
                        >
                            Apply filters
                        </button>
                    </div>

                    <SaveViewPopover
                        open={savePopoverOpen}
                        parts={parts}
                        suggestedName={suggestViewName(parts)}
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

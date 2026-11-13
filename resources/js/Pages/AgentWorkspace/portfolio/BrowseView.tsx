import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Deferred, router } from "@inertiajs/react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import MenuSelect, { type MenuOption } from "@/Components/Redesign/primitives/MenuSelect";
import useTranslation from "@/Hooks/useTranslation";
import { intlLocale } from "./format";
import PropertyCard from "./PropertyCard";
import type { ExposeTarget } from "./PortfolioExposeModal";
import type { BrowseFilters, BrowseOptions, NamedOption, PortfolioProperty, PropertiesPayload } from "./types";

const PortfolioExposeModal = lazy(() => import("./PortfolioExposeModal"));

const ALL = "";
const STEP = 24;
const PRICES = [150000, 200000, 250000, 350000, 500000, 750000, 1000000];
const BEDROOMS = [1, 2, 3, 4];

interface BrowseViewProps {
    filters: BrowseFilters;
    limit: number;
    properties?: PropertiesPayload;
    options?: BrowseOptions;
}

function GridSkeleton() {
    return (
        <ul className="agent-pf__grid agent-pf__grid--browse" aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
                <li key={index} className="agent-pf__card">
                    <div className="dr-skeleton" style={{ height: 118, borderRadius: 12 }} />
                    <div className="dr-skeleton" style={{ height: 14, width: "70%", borderRadius: 6 }} />
                    <div className="dr-skeleton" style={{ height: 12, width: "90%", borderRadius: 6 }} />
                </li>
            ))}
        </ul>
    );
}

/** The filter row's trigger reads "City: Iskele" once something is picked, just "City" before. */
function FilterMenu({
    label,
    value,
    options,
    onChange,
    searchable = false,
}: {
    label: string;
    value: string;
    options: MenuOption[];
    onChange: (value: string) => void;
    searchable?: boolean;
}) {
    const { t } = useTranslation();
    const picked = options.find((option) => String(option.value) === value);
    const all: MenuOption = { value: ALL, label: t("pages.agent_workspace.portfolio.browse.any") };

    return (
        <span className={`agent-pf__filter-wrap${picked ? " is-set" : ""}`}>
            {picked ? <span className="agent-pf__filter-label">{label}:</span> : null}
            <MenuSelect
                value={picked ? value : null}
                options={[all, ...options]}
                onChange={(next) => onChange(String(next))}
                placeholder={label}
                searchable={searchable}
                size="sm"
                triggerClassName="agent-pf__filter"
            />
        </span>
    );
}

const toOptions = (list: NamedOption[] | undefined): MenuOption[] => (list ?? []).map((item) => ({ value: item.name, label: item.label }));

/**
 * Browse (L7-19): every property the agent may see, newest first, narrowed by
 * the filter row. Filters, search and "Show more" are partial visits that
 * keep the page; the cards and the filter options follow the shell.
 */
export default function BrowseView({ filters, limit, properties, options }: BrowseViewProps) {
    const { t, locale } = useTranslation();
    const [expose, setExpose] = useState<ExposeTarget | null>(null);
    const [text, setText] = useState(filters.search ?? "");
    const debounce = useRef<number | null>(null);

    const visit = useCallback((next: BrowseFilters, nextLimit = STEP) => {
        const data: Record<string, string> = {};
        for (const [key, value] of Object.entries(next)) if (value) data[key] = value;
        if (nextLimit > STEP) data.limit = String(nextLimit);
        router.get(route("agent.portfolio.browse"), data, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["properties", "filters", "limit"],
        });
    }, []);

    const set = useCallback((key: keyof BrowseFilters, value: string) => visit({ ...filters, [key]: value }), [filters, visit]);

    useEffect(() => {
        if (text === (filters.search ?? "")) return;
        debounce.current = window.setTimeout(() => visit({ ...filters, search: text }), 300);
        return () => {
            if (debounce.current) window.clearTimeout(debounce.current);
        };
    }, [text, filters, visit]);

    const statusLabels = useMemo(() => new Map((options?.construction_statuses ?? []).map((item) => [item.name, item.label])), [options]);

    const cityOptions = useMemo(() => toOptions(options?.cities), [options]);
    const areaOptions = useMemo<MenuOption[]>(() => (options?.areas ?? []).map((area) => ({ value: area, label: area })), [options]);
    const developerOptions = useMemo<MenuOption[]>(() => (options?.developers ?? []).map((item) => ({ value: String(item.id), label: item.name })), [options]);
    const priceOptions = useMemo<MenuOption[]>(
        () => PRICES.map((price) => ({ value: String(price), label: new Intl.NumberFormat(intlLocale(locale)).format(price) })),
        [locale],
    );
    const bedroomOptions = useMemo<MenuOption[]>(() => BEDROOMS.map((count) => ({ value: String(count), label: `${count}+` })), []);

    const openExpose = useCallback(
        (property: PortfolioProperty) => setExpose({ kind: "property", id: property.id, title: property.title, subtitle: property.project ?? undefined }),
        [],
    );

    const anyFilter = Object.values(filters).some(Boolean);

    return (
        <div className="agent-pf__browse">
            <div className="agent-pf__filters" role="group" aria-label={t("pages.agent_workspace.portfolio.browse.filters")}>
                <FilterMenu label={t("pages.agent_workspace.portfolio.browse.city")} value={filters.city ?? ALL} options={cityOptions} onChange={(v) => set("city", v)} />
                <FilterMenu label={t("pages.agent_workspace.portfolio.browse.area")} value={filters.area ?? ALL} options={areaOptions} onChange={(v) => set("area", v)} searchable />
                <FilterMenu label={t("pages.agent_workspace.portfolio.browse.price")} value={filters.max_price ?? ALL} options={priceOptions} onChange={(v) => set("max_price", v)} />
                <FilterMenu label={t("pages.agent_workspace.portfolio.browse.bedrooms")} value={filters.min_bedrooms ?? ALL} options={bedroomOptions} onChange={(v) => set("min_bedrooms", v)} />
                <FilterMenu
                    label={t("pages.agent_workspace.portfolio.browse.construction")}
                    value={filters.construction_status ?? ALL}
                    options={toOptions(options?.construction_statuses)}
                    onChange={(v) => set("construction_status", v)}
                />
                <FilterMenu label={t("pages.agent_workspace.portfolio.browse.deed")} value={filters.deed_status ?? ALL} options={toOptions(options?.deed_statuses)} onChange={(v) => set("deed_status", v)} />
                <FilterMenu label={t("pages.agent_workspace.portfolio.browse.developer")} value={filters.developer_id ?? ALL} options={developerOptions} onChange={(v) => set("developer_id", v)} searchable />
                <label className="agent-pf__search">
                    <Icon name="search" size={14} />
                    <input
                        type="search"
                        value={text}
                        placeholder={t("pages.agent_workspace.portfolio.browse.search")}
                        aria-label={t("pages.agent_workspace.portfolio.browse.search")}
                        onChange={(event) => setText(event.target.value)}
                    />
                </label>
            </div>

            <Deferred data="properties" fallback={<GridSkeleton />}>
                {properties && properties.items.length > 0 ? (
                    <>
                        <ul className="agent-pf__grid agent-pf__grid--browse">
                            {properties.items.map((property) => (
                                <PropertyCard key={property.id} property={property} statusLabel={statusLabels.get(property.construction_status ?? "")} onExpose={openExpose} />
                            ))}
                        </ul>
                        {properties.total > properties.items.length ? (
                            <div className="agent-pf__more">
                                <button type="button" className="dr-btn dr-btn-sm dr-btn-ghost" onClick={() => visit(filters, limit + STEP)}>
                                    <Icon name="chevron-down" size={13} />
                                    {t("pages.agent_workspace.portfolio.browse.more", { count: properties.total - properties.items.length })}
                                </button>
                            </div>
                        ) : null}
                    </>
                ) : (
                    <section className="agent-pf__panel">
                        <EmptyState
                            icon="building"
                            title={t("pages.agent_workspace.portfolio.browse.empty_title")}
                            description={t(anyFilter ? "pages.agent_workspace.portfolio.browse.empty_filtered" : "pages.agent_workspace.portfolio.browse.empty_description")}
                        />
                    </section>
                )}
            </Deferred>

            {expose ? (
                <Suspense fallback={null}>
                    <PortfolioExposeModal target={expose} onClose={() => setExpose(null)} />
                </Suspense>
            ) : null}
        </div>
    );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import axios from "axios";
import { Spin } from "antd";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import useTranslation from "@/Hooks/useTranslation";
import { matchChoice, sortChoices } from "./model";
import type { UtmConfigOption, UtmKey } from "./types";

interface PageResponse {
    items: UtmConfigOption[];
    nextPage: number | null;
}

interface ListState {
    items: UtmConfigOption[];
    nextPage: number | null;
    loaded: boolean;
}

// Per field + search, kept for the page's lifetime so reopening the modal or
// clearing a search paints at once.
const cache = new Map<string, ListState>();

const EMPTY: ListState = { items: [], nextPage: 1, loaded: false };

function fetchPage(field: UtmKey, page: number, search: string): Promise<PageResponse> {
    return axios
        .get(route("marketing-leads.utm-configs"), {
            params: { field, page, search: search || undefined },
            headers: { Accept: "application/json" },
        })
        .then((res) => res.data as PageResponse);
}

function mergeItems(current: UtmConfigOption[], next: UtmConfigOption[]): UtmConfigOption[] {
    const seen = new Set(current.map((item) => item.value));
    return [...current, ...next.filter((item) => !seen.has(item.value))];
}

interface Props {
    field: UtmKey;
    id: string;
    value: string;
    placeholder: string;
    onChange: (value: string, option: UtmConfigOption | null) => void;
}

/**
 * Pick-only UTM field backed by the options OL manages. Loads a page when it
 * first opens, the next page as the list scrolls to the end, and asks OL
 * again (debounced) as people type, so it stays quick however long the list
 * on OL gets.
 */
export default function UtmConfigSelect({ field, id, value, placeholder, onChange }: Props) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const key = `${field}|${query}`;
    const [list, setList] = useState<ListState>(() => cache.get(key) ?? EMPTY);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [open, setOpen] = useState(false);
    const labels = useRef(new Map<string, UtmConfigOption>());
    const request = useRef(0);

    useEffect(() => {
        const handle = window.setTimeout(() => setQuery(search.trim()), 250);
        return () => window.clearTimeout(handle);
    }, [search]);

    useEffect(() => {
        setList(cache.get(key) ?? EMPTY);
        setFailed(false);
    }, [key]);

    const loadNext = useCallback(() => {
        if (loading || list.nextPage === null) return;
        const ticket = ++request.current;
        const page = list.nextPage;
        setLoading(true);
        setFailed(false);
        fetchPage(field, page, query)
            .then((res) => {
                if (ticket !== request.current) return;
                const next: ListState = {
                    items: mergeItems(list.items, res.items ?? []),
                    nextPage: res.nextPage && res.nextPage > page ? res.nextPage : null,
                    loaded: true,
                };
                cache.set(key, next);
                setList(next);
            })
            .catch(() => ticket === request.current && setFailed(true))
            .finally(() => ticket === request.current && setLoading(false));
    }, [field, key, list, loading, query]);

    // First page when the list opens (or the search changes while open).
    useEffect(() => {
        if (open && !list.loaded && !failed) loadNext();
    }, [open, list.loaded, failed, loadNext]);

    list.items.forEach((item) => labels.current.set(item.value, item));

    const options = useMemo(() => {
        const choices = list.items.map((item) => ({ value: item.value, label: item.label }));
        // Keep the current value visible even when its page isn't loaded.
        if (value && !choices.some((choice) => choice.value === value)) {
            choices.unshift({ value, label: labels.current.get(value)?.label ?? value });
        }
        return choices;
    }, [list.items, value]);

    const onPopupScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (target.scrollTop + target.clientHeight >= target.scrollHeight - 48) loadNext();
    };

    const notFound = failed ? (
        <div className="mli-utm-state">
            <span>{t("pages.marketing_leads.utm_unavailable")}</span>
            <button type="button" className="mli-utm-retry" onClick={() => loadNext()}>
                {t("pages.marketing_leads.utm_retry")}
            </button>
        </div>
    ) : loading || !list.loaded ? (
        <div className="mli-utm-state">
            <Spin size="small" />
        </div>
    ) : (
        <div className="mli-utm-state">{t("pages.marketing_leads.utm_empty")}</div>
    );

    return (
        <SearchableSelect<string>
            id={id}
            allowClear
            value={value || undefined}
            placeholder={placeholder}
            options={options}
            searchValue={search}
            onSearch={setSearch}
            filterOption={matchChoice}
            filterSort={(a, b, info) => sortChoices(info.searchValue)(a, b)}
            onOpenChange={setOpen}
            onPopupScroll={onPopupScroll}
            notFoundContent={notFound}
            onChange={(next) => {
                setSearch("");
                onChange(next ?? "", next ? labels.current.get(next) ?? null : null);
            }}
            popupRender={(menu) => (
                <>
                    {menu}
                    {loading && list.items.length > 0 && (
                        <div className="mli-utm-state">
                            <Spin size="small" />
                        </div>
                    )}
                </>
            )}
            popupMatchSelectWidth
        />
    );
}

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { router, usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import type { PageProps } from "@/Components/DashboardLayout";
import Icon from "../primitives/Icon";
import "./search/agent-search.css";
import { buildHits } from "./search/hits";
import SearchMenu, { menuHits } from "./search/SearchMenu";
import useAgentSearch, { MIN_QUERY_LENGTH } from "./search/useAgentSearch";

/** The word in the address when the results page is open, so the field shows what the page is about. */
function queryFromUrl(url: string): string | null {
    if (!url.split("?")[0].endsWith("/agent/search")) return null;
    try {
        return new URL(url, "http://x").searchParams.get("q") ?? "";
    } catch {
        return "";
    }
}

/**
 * The dock's search (L7-23): as you type, a dropdown of the first few people,
 * deals, properties, tasks and meetings that match, each opening in a click or
 * Enter; "See all" (or Enter with nothing picked) opens the results page.
 * "/" focuses it from anywhere outside a text field. On a phone, where there
 * is no dock, the same field opens from a button in the top bar.
 */
export default function AgentDockSearch({ variant = "dock" }: { variant?: "dock" | "phone" }) {
    const { t, locale } = useTranslation();
    const { timezone } = useUserDateTime();
    const { url, props } = usePage<PageProps>();
    const userId = (props.auth?.user as { id?: number } | undefined)?.id ?? null;
    const [value, setValue] = useState(() => queryFromUrl(url) ?? "");
    const [focused, setFocused] = useState(false);
    const [sheet, setSheet] = useState(false);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const menuId = useId();

    // The field follows the page: the word of the results page, empty anywhere else.
    useEffect(() => {
        setValue(queryFromUrl(url) ?? "");
        setSheet(false);
        setFocused(false);
    }, [url]);

    const open = (variant === "phone" ? sheet : focused) && value.trim().length > 0;
    const { results, loading, failed, retry } = useAgentSearch(value, open);

    const hits = useMemo(
        () => menuHits(buildHits(results, { t, locale, timeZone: timezone, nowMs: Date.now(), userId }, "menu")),
        // The clock only decides "today" and "tomorrow"; a fresh answer is enough to refresh it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [results, t, locale, timezone, userId],
    );

    useEffect(() => setActiveKey(null), [results]);

    useEffect(() => {
        const onKey = (event: globalThis.KeyboardEvent) => {
            if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target as HTMLElement | null;
            if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
            // Both fields are mounted; only the one that can be seen takes the key.
            if (!inputRef.current || inputRef.current.getClientRects().length === 0) {
                if (variant === "phone" && wrapRef.current && wrapRef.current.getClientRects().length > 0) {
                    event.preventDefault();
                    setSheet(true);
                }
                return;
            }
            event.preventDefault();
            inputRef.current.focus();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [variant]);

    useEffect(() => {
        if (sheet) inputRef.current?.focus();
    }, [sheet]);

    // A press outside closes the dropdown; presses inside the menu keep the field focused.
    useEffect(() => {
        if (!focused && !sheet) return;
        const onDown = (event: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
                setFocused(false);
                setSheet(false);
            }
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [focused, sheet]);

    const close = useCallback(() => {
        setFocused(false);
        setSheet(false);
        inputRef.current?.blur();
    }, []);

    const seeAll = useCallback(() => {
        const query = value.trim();
        if (query.length < MIN_QUERY_LENGTH) return;
        close();
        router.visit(route("agent.search", { q: query }));
    }, [value, close]);

    const openHit = useCallback(() => close(), [close]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const active = hits.find((hit) => hit.key === activeKey);
        if (active) {
            close();
            router.visit(active.href);
            return;
        }
        seeAll();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
        }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && hits.length > 0) {
            event.preventDefault();
            const at = hits.findIndex((hit) => hit.key === activeKey);
            const next = event.key === "ArrowDown" ? (at + 1) % hits.length : (at <= 0 ? hits.length : at) - 1;
            setActiveKey(hits[next].key);
        }
    };

    const field = (
        <form role="search" className={variant === "dock" ? "agent-dock__search" : "agent-sq__field"} onSubmit={submit}>
            <Icon name="search" size={14} />
            <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onFocus={() => setFocused(true)}
                onKeyDown={onKeyDown}
                placeholder={t("pages.agent_workspace.search")}
                aria-label={t("pages.agent_workspace.search_people")}
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-activedescendant={open && activeKey ? `${menuId}-${activeKey}` : undefined}
                role="combobox"
                aria-autocomplete="list"
                autoComplete="off"
                className={variant === "dock" ? "agent-dock__search-input" : "agent-sq__input"}
            />
            {variant === "dock" ? (
                <kbd className="agent-dock__kbd" aria-hidden="true">
                    /
                </kbd>
            ) : null}
        </form>
    );

    return (
        <div ref={wrapRef} className={`agent-sq agent-sq--${variant}`}>
            {variant === "phone" ? (
                <button type="button" className="agent-sq__toggle" aria-label={t("pages.agent_workspace.search")} aria-expanded={sheet} onClick={() => setSheet((current) => !current)}>
                    <Icon name="search" size={18} />
                </button>
            ) : null}
            {variant === "phone" ? sheet ? <div className="agent-sq__sheet">{field}</div> : null : field}
            {open ? (
                <SearchMenu
                    id={menuId}
                    query={value}
                    results={results}
                    hits={hits}
                    loading={loading}
                    failed={failed}
                    activeKey={activeKey}
                    onActive={setActiveKey}
                    onOpen={openHit}
                    onSeeAll={seeAll}
                    onRetry={retry}
                />
            ) : null}
        </div>
    );
}

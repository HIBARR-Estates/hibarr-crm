import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import Icon from "@/Components/Redesign/primitives/Icon";
import Switch from "@/Components/Redesign/primitives/Switch";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { useTd } from "@/Hooks/useDynamicTranslation";

const BYPASS_SAVE_URL = "/account/settings/preferences/bypasses";

export type BypassType = {
    key: string;
    label: string;
    group: string;
};

interface NotificationBypassListProps {
    types: BypassType[];
    initialBypassedKeys: string[];
}

type PendingScope = "all" | `group:${string}` | `key:${string}` | null;

function receivingState(
    keys: string[],
    bypassed: Set<string>,
): { checked: boolean; indeterminate: boolean } {
    if (keys.length === 0) {
        return { checked: true, indeterminate: false };
    }
    let bypassedCount = 0;
    for (const key of keys) {
        if (bypassed.has(key)) bypassedCount += 1;
    }
    if (bypassedCount === 0) {
        return { checked: true, indeterminate: false };
    }
    if (bypassedCount === keys.length) {
        return { checked: false, indeterminate: false };
    }
    return { checked: true, indeterminate: true };
}

export default function NotificationBypassList({
    types,
    initialBypassedKeys,
}: NotificationBypassListProps) {
    const { td } = useTd();
    const [query, setQuery] = useState("");
    const [bypassed, setBypassed] = useState<Set<string>>(
        () => new Set(initialBypassedKeys),
    );
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
    const [pending, setPending] = useState<PendingScope>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q === "") return types;
        return types.filter(
            (item) =>
                item.label.toLowerCase().includes(q) ||
                item.group.toLowerCase().includes(q),
        );
    }, [types, query]);

    const grouped = useMemo(() => {
        const map = new Map<string, BypassType[]>();
        for (const item of filtered) {
            const list = map.get(item.group) ?? [];
            list.push(item);
            map.set(item.group, list);
        }
        return Array.from(map.entries());
    }, [filtered]);

    useEffect(() => {
        const q = query.trim();
        if (q === "") return;
        setExpanded(new Set(grouped.map(([group]) => group)));
    }, [query, grouped]);

    const allKeys = useMemo(() => types.map((item) => item.key), [types]);
    const allState = receivingState(allKeys, bypassed);
    const busy = pending !== null;

    const applyBypass = async (
        keys: string[],
        nextBypassed: boolean,
        scope: PendingScope,
    ) => {
        if (keys.length === 0 || pending !== null) return;
        const previous = new Set(bypassed);
        setPending(scope);
        setBypassed((current) => {
            const copy = new Set(current);
            for (const key of keys) {
                if (nextBypassed) copy.add(key);
                else copy.delete(key);
            }
            return copy;
        });
        try {
            await axios.put(BYPASS_SAVE_URL, {
                keys,
                bypassed: nextBypassed,
            });
        } catch {
            setBypassed(previous);
        } finally {
            setPending(null);
        }
    };

    const toggleKeys = (keys: string[], scope: PendingScope) => {
        const { checked, indeterminate } = receivingState(keys, bypassed);
        const currentlyAllOn = checked && !indeterminate;
        void applyBypass(keys, currentlyAllOn, scope);
    };

    const toggleExpanded = (group: string) => {
        setExpanded((current) => {
            const copy = new Set(current);
            if (copy.has(group)) copy.delete(group);
            else copy.add(group);
            return copy;
        });
    };

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 14,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: REDESIGN_TYPE.BODY,
                            color: T.TEXT,
                            fontWeight: 600,
                        }}
                    >
                        {td("All notifications", { source: "en" })}
                    </div>
                    <p
                        style={{
                            margin: "2px 0 0",
                            fontSize: REDESIGN_TYPE.CAPTION,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.4,
                        }}
                    >
                        {td(
                            "On means email, in-app, and push. Security and account emails cannot be turned off.",
                            { source: "en" },
                        )}
                    </p>
                </div>
                <Switch
                    checked={allState.checked}
                    indeterminate={allState.indeterminate}
                    loading={pending === "all"}
                    disabled={busy && pending !== "all"}
                    onChange={() => toggleKeys(allKeys, "all")}
                    aria-label={td("All notifications", { source: "en" })}
                />
            </div>

            <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={td("Search notification types", { source: "en" })}
                aria-label={td("Search notification types", { source: "en" })}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    fontSize: REDESIGN_TYPE.BODY,
                    color: T.TEXT,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 16,
                    outline: "none",
                    background: T.WHITE,
                }}
            />

            {grouped.length === 0 ? (
                <EmptyState
                    title={td("No matching notification types", { source: "en" })}
                    description={td("Try a different search.", { source: "en" })}
                />
            ) : (
                grouped.map(([group, items]) => {
                    const isOpen = expanded.has(group);
                    const groupKeys = items.map((item) => item.key);
                    const groupState = receivingState(groupKeys, bypassed);
                    const groupScope = `group:${group}` as const;
                    return (
                        <div key={group} style={{ marginBottom: 10 }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: isOpen ? "8px 8px 0 0" : 8,
                                    padding: "8px 12px",
                                    background: T.SURFACE_2,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleExpanded(group)}
                                    aria-expanded={isOpen}
                                    style={{
                                        appearance: "none",
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        margin: 0,
                                        padding: 0,
                                        border: 0,
                                        background: "transparent",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        textAlign: "left",
                                        minWidth: 0,
                                    }}
                                >
                                    <Icon
                                        name={isOpen ? "chevron-up" : "chevron-down"}
                                        size={14}
                                        color={T.GRAY_DARK}
                                    />
                                    <span
                                        style={{
                                            fontSize: REDESIGN_TYPE.CAPTION,
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            color: T.GRAY_DARKER,
                                        }}
                                    >
                                        {td(group, { source: "en" })}
                                    </span>
                                </button>
                                <Switch
                                    checked={groupState.checked}
                                    indeterminate={groupState.indeterminate}
                                    loading={pending === groupScope}
                                    disabled={busy && pending !== groupScope}
                                    onChange={() =>
                                        toggleKeys(groupKeys, groupScope)
                                    }
                                    aria-label={`${td("All", { source: "en" })} ${group}`}
                                />
                            </div>
                            {isOpen ? (
                                <div
                                    style={{
                                        border: `1px solid ${T.BORDER}`,
                                        borderTop: "none",
                                        borderRadius: "0 0 8px 8px",
                                        overflow: "hidden",
                                    }}
                                >
                                    {items.map((item, index) => {
                                        const receiving = !bypassed.has(item.key);
                                        const keyScope = `key:${item.key}` as const;
                                        return (
                                            <div
                                                key={item.key}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 12,
                                                    padding: "10px 14px",
                                                    borderTop:
                                                        index === 0
                                                            ? "none"
                                                            : `1px solid ${T.BORDER_SOFT}`,
                                                    background: T.WHITE,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: REDESIGN_TYPE.BODY,
                                                        color: T.TEXT,
                                                    }}
                                                >
                                                    {td(item.label, { source: "en" })}
                                                </span>
                                                <Switch
                                                    checked={receiving}
                                                    loading={pending === keyScope}
                                                    disabled={
                                                        busy && pending !== keyScope
                                                    }
                                                    onChange={() =>
                                                        void applyBypass(
                                                            [item.key],
                                                            receiving,
                                                            keyScope,
                                                        )
                                                    }
                                                    aria-label={item.label}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    );
                })
            )}
        </div>
    );
}

import { useMemo, useState } from "react";
import axios from "axios";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import Switch from "@/Components/Redesign/primitives/Switch";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { useTd } from "@/Hooks/useDynamicTranslation";

export type BypassType = {
    key: string;
    label: string;
    group: string;
};

interface NotificationBypassListProps {
    types: BypassType[];
    initialBypassedKeys: string[];
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
    const [pendingKey, setPendingKey] = useState<string | null>(null);

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

    const toggle = async (key: string) => {
        const next = !bypassed.has(key);
        setPendingKey(key);
        const previous = new Set(bypassed);
        setBypassed((current) => {
            const copy = new Set(current);
            if (next) copy.add(key);
            else copy.delete(key);
            return copy;
        });
        try {
            await axios.put(route("user-preferences.bypasses"), {
                key,
                bypassed: next,
            });
        } catch {
            setBypassed(previous);
        } finally {
            setPendingKey(null);
        }
    };

    return (
        <div>
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
                grouped.map(([group, items]) => (
                    <div key={group} style={{ marginBottom: 18 }}>
                        <div
                            style={{
                                fontSize: REDESIGN_TYPE.CAPTION,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                color: T.GRAY_DARKER,
                                marginBottom: 8,
                            }}
                        >
                            {td(group, { source: "en" })}
                        </div>
                        <div
                            style={{
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 8,
                                overflow: "hidden",
                            }}
                        >
                            {items.map((item, index) => {
                                const isOn = bypassed.has(item.key);
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
                                            checked={isOn}
                                            loading={pendingKey === item.key}
                                            onChange={() => void toggle(item.key)}
                                            aria-label={`${td("Bypass", { source: "en" })} ${item.label}`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

import { useEffect, useRef, useState } from "react";
import { useFormData } from "@/Hooks/useFormData";
import { useDebounce } from "@/Hooks/useDebounce";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

export interface LeadOption {
    id: number;
    client_name: string;
    client_name_salutation?: string;
    client_email?: string | null;
}

interface LeadPickerProps {
    value: LeadOption | null;
    onChange: (lead: LeadOption | null) => void;
    placeholder?: string;
    autoFocus?: boolean;
    searchingLabel?: string;
    emptyLabel?: string;
}

/**
 * Remote-search lead picker (the `leads` form-data endpoint, non-paginated
 * dropdown branch — see LeadService::getDropdownLeads()). Shows a text input
 * that queries by name/email as you type; picking a result collapses it into
 * a read-only chip with a clear button, matching how other pickers in this
 * area (AgentPicker) present a selection.
 */
export default function LeadPicker({
    value,
    onChange,
    placeholder = "Search leads by name or email…",
    autoFocus,
    searchingLabel = "Searching…",
    emptyLabel = "No leads match",
}: LeadPickerProps) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const debouncedQuery = useDebounce(query, 300);
    const containerRef = useRef<HTMLDivElement>(null);

    const { data, loading } = useFormData<LeadOption>("leads", {
        search: debouncedQuery,
        per_page: 20,
        paginate: false,
        enabled: open && debouncedQuery.trim().length > 0,
    });
    const leads = (data as LeadOption[] | undefined) ?? [];

    useEffect(() => {
        if (!open) return;

        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    if (value) {
        return (
            <div
                className="dr-input w-full flex items-center justify-between gap-2"
                style={{ cursor: "default" }}
            >
                <span className="truncate" style={{ fontSize: 13 }}>
                    {value.client_name_salutation ?? value.client_name}
                    {value.client_email && (
                        <span style={{ color: T.TEXT_MUTED }}> · {value.client_email}</span>
                    )}
                </span>
                <button
                    type="button"
                    onClick={() => {
                        onChange(null);
                        setQuery("");
                    }}
                    aria-label="Clear selected lead"
                    style={{ color: T.TEXT_MUTED, flexShrink: 0, fontSize: 16, lineHeight: 1 }}
                >
                    ×
                </button>
            </div>
        );
    }

    return (
        <div ref={containerRef} style={{ position: "relative" }}>
            <input
                className="dr-input w-full"
                type="search"
                autoFocus={autoFocus}
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                aria-label={placeholder}
            />
            {open && query.trim() && (
                <div
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        background: "#fff",
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 8,
                        marginTop: 4,
                        maxHeight: 220,
                        overflowY: "auto",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                >
                    {loading ? (
                        <div className="px-3 py-2 text-xs italic" style={{ color: T.TEXT_MUTED }}>
                            {searchingLabel}
                        </div>
                    ) : leads.length === 0 ? (
                        <div className="px-3 py-2 text-xs italic" style={{ color: T.TEXT_MUTED }}>
                            {emptyLabel}
                        </div>
                    ) : (
                        leads.map((lead) => (
                            <button
                                key={lead.id}
                                type="button"
                                className="dr-menu-item"
                                style={{ width: "100%", textAlign: "left", padding: "8px 12px" }}
                                onClick={() => {
                                    onChange(lead);
                                    setOpen(false);
                                    setQuery("");
                                }}
                            >
                                <span style={{ display: "block", fontSize: 13 }}>
                                    {lead.client_name_salutation ?? lead.client_name}
                                </span>
                                {lead.client_email && (
                                    <span style={{ display: "block", fontSize: 12, color: T.TEXT_MUTED }}>
                                        {lead.client_email}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

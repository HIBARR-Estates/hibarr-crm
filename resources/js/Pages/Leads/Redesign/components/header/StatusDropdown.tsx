import { useEffect, useRef, useState } from "react";
import { Icon } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { LIFECYCLE_STATUS_TONE } from "../../config/lifecycleBanners";

export interface LeadStatusOption {
    id: number;
    key: string;
    label: string;
}

interface StatusDropdownProps {
    statusKey: string;
    statusLabel: string;
    tone: string;
    statuses: LeadStatusOption[];
    onSelect: (key: string) => void;
    saving?: boolean;
}

export default function StatusDropdown({
    statusKey,
    statusLabel,
    tone,
    statuses,
    onSelect,
    saving = false,
}: StatusDropdownProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                type="button"
                className={`v2-pill v2-pill-${tone} v2-pill-status`}
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={saving}
            >
                {td(statusLabel)}{" "}
                <Icon name="chevron-down" size={12} />
            </button>
            {open && (
                <div
                    className="v2-menu v2-menu-left"
                    role="listbox"
                    style={{ minWidth: 220, maxHeight: 360, overflow: "auto" }}
                >
                    <div className="v2-menu-label">{td("Set status")}</div>
                    {statuses.map((option) => {
                        const active = statusKey === option.key;
                        return (
                            <button
                                key={option.key}
                                type="button"
                                role="option"
                                aria-selected={active}
                                className={`v2-menu-item${active ? " active" : ""}`}
                                onClick={() => {
                                    onSelect(option.key);
                                    setOpen(false);
                                }}
                            >
                                <span
                                    className={`v2-pill v2-pill-${
                                        LIFECYCLE_STATUS_TONE[option.key] ?? "gray"
                                    }`}
                                    style={{ pointerEvents: "none" }}
                                >
                                    {td(option.label)}
                                </span>
                                <span style={{ flex: 1 }} />
                                {active && <Icon name="check" size={14} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

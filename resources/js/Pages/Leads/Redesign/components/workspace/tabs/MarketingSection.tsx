import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/Components/Redesign";

interface MarketingSectionProps {
    title: string;
    icon: string;
    /** Sections start expanded; users collapse the ones they don't need. */
    defaultOpen?: boolean;
    children: ReactNode;
}

/** A Marketing-tab card whose header toggles the body open/closed. */
export default function MarketingSection({
    title,
    icon,
    defaultOpen = true,
    children,
}: MarketingSectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    const bodyId = useId();

    return (
        <section className="v2-mkt-section">
            <header
                className={`v2-mkt-section-head${open ? "" : " is-collapsed"}`}
            >
                <button
                    type="button"
                    className="v2-mkt-section-toggle"
                    onClick={() => setOpen((prev) => !prev)}
                    aria-expanded={open}
                    aria-controls={bodyId}
                >
                    <Icon name={icon} size={14} />
                    <span className="v2-mkt-section-title">{title}</span>
                    <Icon
                        name={open ? "chevron-up" : "chevron-down"}
                        size={14}
                    />
                </button>
            </header>
            {open && <div id={bodyId}>{children}</div>}
        </section>
    );
}

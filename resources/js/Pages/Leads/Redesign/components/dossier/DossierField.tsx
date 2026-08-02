import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealIcon from "@/Pages/Deals/Redesign/components/primitives/DealIcon";

interface DossierFieldProps {
    value: string;
    placeholder?: string;
    tone?: "green";
    /** When true, clicking a filled value copies it to the clipboard. */
    copyable?: boolean;
}

export default function DossierField({
    value,
    placeholder = "Not set",
    tone,
    copyable = true,
}: DossierFieldProps) {
    const { td } = useTd();
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<number | null>(null);
    const empty = !value.trim();
    const resolvedPlaceholder = td(placeholder);
    const canCopy = copyable && !empty;

    useEffect(() => {
        return () => {
            if (timerRef.current != null) window.clearTimeout(timerRef.current);
        };
    }, []);

    const handleCopy = async () => {
        if (!canCopy) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            if (timerRef.current != null) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => setCopied(false), 1600);
        } catch {
            /* clipboard may be unavailable */
        }
    };

    if (!canCopy) {
        return (
            <span
                className={`v2-dossier-value${empty ? " empty" : ""}${
                    tone === "green" && !empty ? " green" : ""
                }`}
            >
                {empty ? resolvedPlaceholder : value}
            </span>
        );
    }

    return (
        <button
            type="button"
            className={`v2-dossier-value v2-dossier-value--copy${
                tone === "green" ? " green" : ""
            }${copied ? " is-copied" : ""}`}
            onClick={() => void handleCopy()}
            title={copied ? td("Copied") : td("Click to copy")}
            aria-label={copied ? td("Copied") : td("Click to copy")}
        >
            <span className="v2-dossier-value__text">{value}</span>
            <span className="v2-dossier-value__action" aria-hidden="true">
                {copied ? (
                    <>
                        <DealIcon name="check" size={12} />
                        <span className="v2-dossier-value__copied">
                            {td("Copied")}
                        </span>
                    </>
                ) : (
                    <DealIcon name="copy" size={12} />
                )}
            </span>
        </button>
    );
}

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

function fallbackCopy(text: string): boolean {
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

export default function DossierField({
    value,
    placeholder = "Not set",
    tone,
    copyable = true,
}: DossierFieldProps) {
    const { td } = useTd();
    const [copied, setCopied] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    const timerRef = useRef<number | null>(null);
    const empty = !value.trim();
    const resolvedPlaceholder = td(placeholder);
    const canCopy = copyable && !empty;

    useEffect(() => {
        return () => {
            if (timerRef.current != null) window.clearTimeout(timerRef.current);
        };
    }, []);

    const markCopied = (ok: boolean) => {
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        if (ok) {
            setCopied(true);
            setCopyFailed(false);
            timerRef.current = window.setTimeout(() => setCopied(false), 1600);
        } else {
            setCopied(false);
            setCopyFailed(true);
            timerRef.current = window.setTimeout(() => setCopyFailed(false), 2000);
        }
    };

    const handleCopy = async () => {
        if (!canCopy) return;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                markCopied(true);
                return;
            }
        } catch {
            /* try fallback */
        }
        markCopied(fallbackCopy(value));
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
            }`}
            onClick={handleCopy}
            title={
                copyFailed
                    ? td("Could not copy")
                    : copied
                      ? td("Copied")
                      : td("Copy")
            }
        >
            <span>{value}</span>
            <DealIcon name={copied ? "check" : "copy"} size={12} />
        </button>
    );
}

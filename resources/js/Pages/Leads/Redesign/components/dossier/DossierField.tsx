import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface DossierFieldProps {
    value: string;
    placeholder?: string;
    tone?: "green";
    editing: boolean;
    autoFocus?: boolean;
    onCommit?: (next: string) => void;
    onCancel?: () => void;
}

export default function DossierField({
    value,
    placeholder = "Not set",
    tone,
    editing,
    autoFocus = false,
    onCommit,
    onCancel,
}: DossierFieldProps) {
    const { td } = useTd();
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const resolvedPlaceholder = td(placeholder);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    useEffect(() => {
        if (editing && autoFocus && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing, autoFocus]);

    if (!editing) {
        const empty = !value.trim();
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
        <input
            ref={inputRef}
            className="v2-inline-input"
            value={draft}
            placeholder={resolvedPlaceholder}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => onCommit?.(draft)}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                    event.preventDefault();
                    setDraft(value);
                    onCancel?.();
                }
            }}
        />
    );
}

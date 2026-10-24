import { useTd } from "@/Hooks/useDynamicTranslation";
import useCopyToClipboard from "@/Hooks/useCopyToClipboard";
import Icon from "@/Components/Redesign/primitives/Icon";
import { isMeaningfulDossierValue } from "../../adapters/dossierAdapter";

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
    const { copy, copied, copyFailed } = useCopyToClipboard();
    const empty = !isMeaningfulDossierValue(value);
    const resolvedPlaceholder = td(placeholder, { source: "en" });
    // Never show the copy icon for empty / placeholder / invalid display values.
    const canCopy = copyable && !empty;

    const handleCopy = () => {
        if (!canCopy) return;
        void copy(value.trim());
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
            onClick={handleCopy}
            title={
                copyFailed
                    ? td("Could not copy", { source: "en" })
                    : copied
                      ? td("Copied", { source: "en" })
                      : td("Copy", { source: "en" })
            }
        >
            <span className="v2-dossier-value__text">{value}</span>
            {/* Hidden until the row is hovered or focused (and while the
                "copied" tick shows) so the dossier reads as plain values
                rather than a column of icons — see lead-redesign.css. */}
            <span className="v2-dossier-value__action" aria-hidden="true">
                <Icon name={copied ? "check" : "copy"} size={12} />
            </span>
        </button>
    );
}

import type { MouseEvent } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useCopyToClipboard from "@/Hooks/useCopyToClipboard";
import Icon from "./Icon";

interface CopyValueButtonProps {
    /** Plain text put on the clipboard. Blank text renders nothing. */
    value: string;
    /** The field's visible label, appended to the accessible name ("Copy Deal name"). */
    label?: string;
    className?: string;
}

/**
 * Icon-only copy affordance for a field value that already has its own click
 * behaviour (e.g. click-to-edit), so the value itself can't be the copy target
 * the way it is in the Lead dossier. Same glyphs and copied/failed states as
 * the dossier's DossierField.
 *
 * Revealed on hover/focus of the nearest `group` ancestor (DetailField and the
 * dossier row both provide one), and stays visible while the tick shows.
 */
export default function CopyValueButton({
    value,
    label,
    className = "",
}: CopyValueButtonProps) {
    const { td } = useTd();
    const { copy, copied, copyFailed } = useCopyToClipboard();
    const text = value.trim();

    if (!text) return null;

    const stateLabel = copyFailed
        ? td("Could not copy", { source: "en" })
        : copied
          ? td("Copied", { source: "en" })
          : td("Copy", { source: "en" });

    // Hosts are often click-to-edit (and double-click-to-edit) containers:
    // copying must not also open the editor.
    // Enter/Space on the button fire onClick, so keyboard use is covered too.
    const stop = (event: MouseEvent) => event.stopPropagation();

    return (
        <button
            type="button"
            title={stateLabel}
            aria-label={label ? `${stateLabel} ${label}` : stateLabel}
            onClick={(event) => {
                event.stopPropagation();
                void copy(text);
            }}
            onDoubleClick={stop}
            className={`inline-flex shrink-0 cursor-pointer items-center rounded border-0 bg-transparent p-0.5 transition-[opacity,color] focus-visible:opacity-100 ${
                copied
                    ? "text-dr-green opacity-100"
                    : "text-dr-text-hint opacity-0 hover:text-dr-blue group-hover:opacity-100 group-focus-within:opacity-100"
            } ${className}`}
        >
            <Icon name={copied ? "check" : "copy"} size={12} />
        </button>
    );
}

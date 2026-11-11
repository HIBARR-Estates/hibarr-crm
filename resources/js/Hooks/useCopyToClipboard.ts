import { useCallback, useEffect, useRef, useState } from "react";

/** How long the "copied" tick stays up after a successful copy. */
const COPIED_MS = 1600;
/** How long the "could not copy" state stays up after a failed copy. */
const FAILED_MS = 2000;

/**
 * Legacy execCommand path. navigator.clipboard is only defined in secure
 * contexts (HTTPS/localhost) and its writeText can also reject (permissions,
 * unfocused document), so this is what still copies on plain-HTTP internal
 * hosts.
 */
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

/** Clipboard API first, execCommand fallback. Resolves to whether it copied. */
export async function writeToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* try fallback */
    }
    return fallbackCopy(text);
}

/**
 * Copy-to-clipboard with a transient copied/failed state, shared by the Lead
 * dossier values and the Deal info fields so both behave the same way.
 *
 * `copy` ignores blank text (resolves false without touching state), so an
 * empty field can never flash a false "copied" tick.
 */
export default function useCopyToClipboard() {
    const [copied, setCopied] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current != null) window.clearTimeout(timerRef.current);
        };
    }, []);

    const copy = useCallback(async (text: string): Promise<boolean> => {
        if (!text.trim()) return false;
        const ok = await writeToClipboard(text);
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        setCopied(ok);
        setCopyFailed(!ok);
        timerRef.current = window.setTimeout(
            () => (ok ? setCopied(false) : setCopyFailed(false)),
            ok ? COPIED_MS : FAILED_MS,
        );
        return ok;
    }, []);

    return { copy, copied, copyFailed };
}

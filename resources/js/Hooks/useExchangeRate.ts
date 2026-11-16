import { useCallback, useEffect, useState } from "react";
import axios from "axios";

interface ExchangeRateState {
    /** Units of `to` one unit of `from` buys; 1 for the same currency. */
    rate: number | null;
    loading: boolean;
    /** The live rate couldn't be fetched (network or no published rate). */
    unavailable: boolean;
    /** Fetch the live rate again. No-op when the pair is the same currency. */
    reload: () => void;
}

function idleState(active: boolean, identity: boolean): Omit<ExchangeRateState, "reload"> {
    if (!active) return { rate: null, loading: false, unavailable: false };
    if (identity) return { rate: 1, loading: false, unavailable: false };
    return { rate: null, loading: true, unavailable: false };
}

/**
 * Live reference rate from `exchange-rate.show` (cached server-side, 12h).
 * Pass `enabled: false` to skip fetching, e.g. while a modal is closed.
 *
 * The rate is a suggestion: callers prefill an editable field with it and
 * keep whatever the user confirms.
 */
export default function useExchangeRate(
    from: string | null | undefined,
    to: string | null | undefined,
    enabled = true,
): ExchangeRateState {
    const fromCode = from?.toUpperCase() ?? "";
    const toCode = to?.toUpperCase() ?? "";
    const active = Boolean(enabled && fromCode && toCode);
    const identity = active && fromCode === toCode;
    const [attempt, setAttempt] = useState(0);
    const requestKey = `${attempt}|${active ? "1" : "0"}|${identity ? "1" : "0"}|${fromCode}|${toCode}`;

    const [requestKeyState, setRequestKeyState] = useState(requestKey);
    const [state, setState] = useState(() => idleState(active, identity));

    // Drop a rate that belongs to the previous pair before paint, so a
    // currency switch never briefly applies the old rate to the new one.
    if (requestKey !== requestKeyState) {
        setRequestKeyState(requestKey);
        setState(idleState(active, identity));
    }

    useEffect(() => {
        if (!active || identity) return undefined;

        let cancelled = false;

        axios
            .get(route("exchange-rate.show"), {
                params: { from: fromCode, to: toCode },
                headers: { Accept: "application/json" },
            })
            .then(({ data }) => {
                if (cancelled) return;
                const rate = Number(data?.rate);
                setState(
                    Number.isFinite(rate) && rate > 0
                        ? { rate, loading: false, unavailable: false }
                        : { rate: null, loading: false, unavailable: true },
                );
            })
            .catch(() => {
                if (!cancelled) setState({ rate: null, loading: false, unavailable: true });
            });

        return () => {
            cancelled = true;
        };
    }, [active, identity, fromCode, toCode, attempt]);

    const reload = useCallback(() => setAttempt((n) => n + 1), []);

    return { ...state, reload };
}

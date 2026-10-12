import { useEffect, useState } from "react";
import axios from "axios";

interface ExchangeRateState {
    /** Units of `to` one unit of `from` buys; 1 for the same currency. */
    rate: number | null;
    loading: boolean;
    /** The live rate couldn't be fetched (network or no published rate). */
    unavailable: boolean;
}

/**
 * Live reference rate from `exchange-rate.show` (cached server-side, 12h).
 * Pass `enabled: false` to skip fetching, e.g. while a modal is closed.
 */
export default function useExchangeRate(
    from: string | null | undefined,
    to: string | null | undefined,
    enabled = true,
): ExchangeRateState {
    const [state, setState] = useState<ExchangeRateState>({
        rate: null,
        loading: false,
        unavailable: false,
    });

    useEffect(() => {
        if (!enabled || !from || !to) {
            setState({ rate: null, loading: false, unavailable: false });
            return undefined;
        }
        if (from.toUpperCase() === to.toUpperCase()) {
            setState({ rate: 1, loading: false, unavailable: false });
            return undefined;
        }

        let cancelled = false;
        setState({ rate: null, loading: true, unavailable: false });

        axios
            .get(route("exchange-rate.show"), {
                params: { from, to },
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
    }, [enabled, from, to]);

    return state;
}

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import type { SearchResults } from "./types";

export const MIN_QUERY_LENGTH = 2;

interface State {
    results: SearchResults | null;
    loading: boolean;
    failed: boolean;
}

/**
 * The dropdown's results for what is typed: asked for 180ms after the last
 * keystroke, one request at a time (a newer word cancels the older one), and
 * remembered per word so deleting back to an earlier word answers at once.
 */
export default function useAgentSearch(query: string, enabled: boolean): State & { retry: () => void } {
    const [state, setState] = useState<State>({ results: null, loading: false, failed: false });
    const cache = useRef(new Map<string, SearchResults>());
    const [attempt, setAttempt] = useState(0);
    const word = query.trim();

    useEffect(() => {
        if (!enabled || word.length < MIN_QUERY_LENGTH) {
            setState({ results: null, loading: false, failed: false });
            return;
        }
        const cached = cache.current.get(word.toLowerCase());
        if (cached) {
            setState({ results: cached, loading: false, failed: false });
            return;
        }

        setState((current) => ({ results: current.results, loading: true, failed: false }));
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            axios
                .get<SearchResults>(route("agent.search.suggest"), { params: { q: word }, signal: controller.signal })
                .then((response) => {
                    cache.current.set(word.toLowerCase(), response.data);
                    setState({ results: response.data, loading: false, failed: false });
                })
                .catch((error) => {
                    if (axios.isCancel(error)) return;
                    setState({ results: null, loading: false, failed: true });
                });
        }, 180);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [word, enabled, attempt]);

    return { ...state, retry: () => setAttempt((count) => count + 1) };
}

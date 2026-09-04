import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

export interface PipelineOption {
    id: number;
    name: string;
    stages: Array<{ id: number; lead_pipeline_id: number; name: string; priority: number }>;
}

export interface PipelineOptionsResult {
    pipelines: PipelineOption[];
    loading: boolean;
    /** True when the fetch failed — distinguishes "no pipelines exist" from "we couldn't ask". */
    error: boolean;
}

/**
 * Pipelines (with stages) this company's custom-field visibility UI can
 * target — the generic rule builder's Pipeline/Pipeline stage source picker,
 * and the simplified "show for pipeline(s)" picker on a Lead FILE field.
 *
 * `enabled` gates the request: the Lead FILE picker lives inside a modal that
 * is mounted (closed) for the whole Custom Fields settings page, so fetching
 * on mount cost every visit an XHR for a picker most visits never open. Pass
 * false until the picker is actually on screen; the fetch then runs once, the
 * first time it flips true.
 *
 * `error` is reported separately from an empty list: a failed fetch used to
 * be indistinguishable from a company that genuinely has no pipelines, so the
 * picker rendered "no pipelines" either way.
 */
export default function usePipelineOptions(enabled: boolean = true): PipelineOptionsResult {
    const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(false);
    // `enabled` typically toggles with a form control, so latch the fetch:
    // flipping the picker off and back on shouldn't re-request the list. The
    // latch is released again on failure, so a reopened picker retries rather
    // than showing the error state forever.
    const fetched = useRef(false);

    useEffect(() => {
        if (!enabled || fetched.current) return;
        fetched.current = true;
        let cancelled = false;
        setLoading(true);
        setError(false);
        axios
            .get(route('custom-fields.pipeline-options'), { headers: { Accept: 'application/json' } })
            .then((res) => {
                if (cancelled) return;
                const raw: PipelineOption[] = res.data?.pipelines ?? [];
                // `stages` is non-optional on PipelineOption and consumers index
                // into it directly, so guarantee the array rather than trusting
                // the payload to always have carried the eager-loaded relation.
                setPipelines(
                    raw.map((pipeline) => ({
                        ...pipeline,
                        stages: Array.isArray(pipeline?.stages) ? pipeline.stages : [],
                    })),
                );
            })
            .catch(() => {
                // Released even when cancelled: the request never produced a
                // usable list, so the next time the picker is shown it should
                // be free to ask again.
                fetched.current = false;
                if (cancelled) return;
                setPipelines([]);
                setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return useMemo(
        () => ({ pipelines, loading, error }),
        [pipelines, loading, error],
    );
}

import { useEffect, useMemo, useState } from 'react';
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
 * Fetched once per mount.
 *
 * `error` is reported separately from an empty list: a failed fetch used to
 * be indistinguishable from a company that genuinely has no pipelines, so the
 * picker rendered "no pipelines" either way.
 */
export default function usePipelineOptions(): PipelineOptionsResult {
    const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        axios
            .get(route('custom-fields.pipeline-options'), { headers: { Accept: 'application/json' } })
            .then((res) => {
                if (!cancelled) setPipelines(res.data?.pipelines ?? []);
            })
            .catch(() => {
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
    }, []);

    return useMemo(
        () => ({ pipelines, loading, error }),
        [pipelines, loading, error],
    );
}

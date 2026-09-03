import { useEffect, useState } from 'react';
import axios from 'axios';

export interface PipelineOption {
    id: number;
    name: string;
    stages: Array<{ id: number; lead_pipeline_id: number; name: string; priority: number }>;
}

/**
 * Pipelines (with stages) this company's custom-field visibility UI can
 * target — the generic rule builder's Pipeline/Pipeline stage source picker,
 * and the simplified "show for pipeline(s)" picker on a Lead FILE field.
 * Fetched once per mount.
 */
export default function usePipelineOptions(): PipelineOption[] {
    const [pipelines, setPipelines] = useState<PipelineOption[]>([]);

    useEffect(() => {
        let cancelled = false;
        axios
            .get(route('custom-fields.pipeline-options'), { headers: { Accept: 'application/json' } })
            .then((res) => {
                if (!cancelled) setPipelines(res.data?.pipelines ?? []);
            })
            .catch(() => {
                if (!cancelled) setPipelines([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return pipelines;
}

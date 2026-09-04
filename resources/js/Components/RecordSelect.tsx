import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Select } from 'antd';
import { useDebounce } from '@/Hooks/useDebounce';

interface RecordOption {
    id: number;
    name: string;
}

interface RecordSelectProps {
    /** The custom field being edited — its module (resolved server-side from custom_field_groups.model) decides which table this searches. */
    fieldId: number;
    value?: string[];
    onChange?: (value: string[]) => void;
    placeholder?: string;
}

/**
 * Remote search-as-you-type multi-select for a custom field's "record"
 * visibility source (CustomFieldRuleBuilder) — restricting a field to one
 * or several specific records. The options list is the field's own module
 * (Deal/Lead/...), resolved server-side, so this never needs to know which
 * module it's searching. Already-selected ids are kept in `options` across
 * searches (merged, not replaced) so their labels stay visible even once a
 * later search no longer matches them, and any selected id with no label yet
 * is requested explicitly (`ids`) so a saved rule never renders as bare ids.
 */
export default function RecordSelect({
    fieldId,
    value,
    onChange,
    placeholder,
}: RecordSelectProps) {
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [options, setOptions] = useState<RecordOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    // Selected ids we have no label for yet — asked for by id alongside the
    // search so they resolve even when outside the search's first 20 hits.
    const unhydratedIds = useMemo(() => {
        const known = new Set(options.map((o) => String(o.id)));
        return (value ?? []).filter((id) => !known.has(String(id)));
    }, [value, options]);

    // Serialized so the effect re-runs when the actual set changes, not on
    // every render that rebuilds the array.
    const unhydratedKey = unhydratedIds.join(',');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        axios
            .get(route('custom-fields.record-options', fieldId), {
                params: {
                    q: debouncedSearch,
                    ...(unhydratedKey ? { ids: unhydratedKey.split(',') } : {}),
                },
            })
            .then((res) => {
                if (cancelled) return;
                const fetched: RecordOption[] = res.data?.data ?? [];
                setOptions((prev) => {
                    const byId = new Map(prev.map((o) => [o.id, o]));
                    fetched.forEach((o) => byId.set(o.id, o));
                    return Array.from(byId.values());
                });
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [fieldId, debouncedSearch, unhydratedKey]);

    const notFoundContent = loading
        ? 'Searching…'
        : failed
          ? 'Could not load records'
          : 'No matches';

    return (
        <Select
            mode="multiple"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            showSearch
            filterOption={false}
            loading={loading}
            searchValue={search}
            onSearch={setSearch}
            notFoundContent={notFoundContent}
            options={options.map((o) => ({ value: String(o.id), label: o.name }))}
        />
    );
}

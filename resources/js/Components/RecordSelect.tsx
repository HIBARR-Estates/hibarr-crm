import { useEffect, useState } from 'react';
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
 * later search no longer matches them.
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

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        axios
            .get(route('custom-fields.record-options', fieldId), {
                params: { q: debouncedSearch },
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
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [fieldId, debouncedSearch]);

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
            notFoundContent={loading ? 'Searching…' : 'No matches'}
            options={options.map((o) => ({ value: String(o.id), label: o.name }))}
        />
    );
}

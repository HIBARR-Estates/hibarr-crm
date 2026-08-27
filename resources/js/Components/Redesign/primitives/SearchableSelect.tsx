import { Select } from "antd";
import type { SelectProps } from "antd";

export type SearchableSelectOption = { value: string | number; label: string };
export type SearchableSelectGroup = { label: string; options: SearchableSelectOption[] };

interface SearchableSelectProps<T extends string | number>
    extends Omit<SelectProps<T>, "options" | "showSearch" | "optionFilterProp"> {
    options: SearchableSelectOption[] | SearchableSelectGroup[];
}

/**
 * The one searchable/positioned dropdown for this redesign area — every
 * `<select>` with more than a handful of fixed options should go through
 * this instead of a bare native `<select>` or an ad-hoc `<Select>`, so
 * search behavior and popup width/positioning stay consistent everywhere.
 * Thin by design: it's antd's `Select` with `showSearch` and
 * `optionFilterProp="label"` pinned on, nothing else — antd already
 * auto-flips the popup near viewport edges, so no extra positioning logic
 * is needed here.
 */
export default function SearchableSelect<T extends string | number>({
    options,
    popupMatchSelectWidth = 280,
    ...props
}: SearchableSelectProps<T>) {
    return (
        <Select<T>
            {...props}
            options={options}
            showSearch
            optionFilterProp="label"
            popupMatchSelectWidth={popupMatchSelectWidth}
        />
    );
}

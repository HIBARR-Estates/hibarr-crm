import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { customFieldOptions, matchChoice, sortChoices, SUPPORTED_CUSTOM_FIELD_TYPES } from "./model";
import type { CountryOption, MarketingCustomField } from "./types";

interface CustomFieldInputProps {
    field: MarketingCustomField;
    value: unknown;
    error?: string;
    countries: CountryOption[];
    onChange: (value: unknown) => void;
}

const WIDE_TYPES = new Set(["textarea", "checkbox", "radio", "multiselect", "multiSelectCountry"]);

/** One lead custom field in the marketing flow, drawn with the redesign field styles. */
export default function CustomFieldInput({ field, value, error, countries, onChange }: CustomFieldInputProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const id = `mli-cf-${field.id}`;
    const label = td(field.label, { source: "en" });
    const wide = WIDE_TYPES.has(field.type);
    const className = `mli-fld${wide ? " mli-span-3" : ""}${error ? " has-error" : ""}`;

    if (!SUPPORTED_CUSTOM_FIELD_TYPES.has(field.type)) {
        return (
            <div className={className}>
                <span className="mli-fld__label">{label}</span>
                <div className="mli-unsupported">{t("pages.marketing_leads.custom_field_after_save")}</div>
            </div>
        );
    }

    const text = typeof value === "string" ? value : value == null ? "" : String(value);
    const list = Array.isArray(value) ? value.map(String) : [];
    const options = customFieldOptions(field);
    const countryOptions = countries
        .filter((country) => country.nicename)
        .map((country) => ({ value: String(country.nicename), label: String(country.nicename) }));

    const toggle = (option: string) =>
        onChange(list.includes(option) ? list.filter((item) => item !== option) : [...list, option]);

    let control;
    switch (field.type) {
        case "textarea":
            control = <textarea id={id} className="mli-inp" value={text} onChange={(event) => onChange(event.target.value)} />;
            break;
        case "number":
        case "currency":
            control = (
                <input id={id} className="mli-inp" type="number" inputMode="decimal" value={text} onChange={(event) => onChange(event.target.value)} />
            );
            break;
        case "date":
            control = <input id={id} className="mli-inp" type="date" value={text} onChange={(event) => onChange(event.target.value)} />;
            break;
        case "select":
            control = (
                <SearchableSelect<string>
                    id={id}
                    allowClear
                    value={text || undefined}
                    placeholder={t("pages.marketing_leads.choose")}
                    options={options.map((option) => ({ value: option, label: option }))}
                    onChange={(next) => onChange(next ?? "")}
                    filterOption={matchChoice}
                    filterSort={(a, b, info) => sortChoices(info.searchValue)(a, b)}
                    popupMatchSelectWidth
                />
            );
            break;
        case "country":
            control = (
                <SearchableSelect<string>
                    id={id}
                    allowClear
                    value={text || undefined}
                    placeholder={t("pages.marketing_leads.choose")}
                    options={countryOptions}
                    onChange={(next) => onChange(next ?? "")}
                    filterOption={matchChoice}
                    filterSort={(a, b, info) => sortChoices(info.searchValue)(a, b)}
                    popupMatchSelectWidth
                />
            );
            break;
        case "multiSelectCountry":
            control = (
                <SearchableSelect<string[]>
                    id={id}
                    mode="multiple"
                    allowClear
                    value={list}
                    placeholder={t("pages.marketing_leads.choose")}
                    options={countryOptions}
                    onChange={(next) => onChange(next ?? [])}
                    filterOption={matchChoice}
                    filterSort={(a, b, info) => sortChoices(info.searchValue)(a, b)}
                    popupMatchSelectWidth
                />
            );
            break;
        case "radio":
            control = (
                <div className="mli-chips" role="radiogroup" aria-labelledby={`${id}-label`}>
                    {options.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className="mli-chip"
                            role="radio"
                            aria-checked={text === option}
                            onClick={() => onChange(text === option ? "" : option)}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            );
            break;
        case "checkbox":
        case "multiselect":
            control = (
                <div className="mli-chips" role="group" aria-labelledby={`${id}-label`}>
                    {options.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className="mli-chip"
                            aria-pressed={list.includes(option)}
                            onClick={() => toggle(option)}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            );
            break;
        default:
            control = (
                <input
                    id={id}
                    className="mli-inp"
                    type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "phone" ? "tel" : "text"}
                    value={text}
                    onChange={(event) => onChange(event.target.value)}
                />
            );
    }

    const grouped = field.type === "radio" || field.type === "checkbox" || field.type === "multiselect";

    return (
        <div className={className}>
            {grouped ? (
                <span id={`${id}-label`} className="mli-fld__label">
                    {label}
                </span>
            ) : (
                <label htmlFor={id}>{label}</label>
            )}
            {control}
            {error && <span className="mli-fld__error">{error}</span>}
        </div>
    );
}

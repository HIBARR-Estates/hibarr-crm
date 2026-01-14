import React, { useState, useEffect, useMemo } from "react";
import { Select, Skeleton, Spin, message } from "antd";
import {
    FormDataType,
    useFormData,
    useFormDataBatch,
} from "@/Hooks/useFormData";

interface FormDataSelectorProps {
    type: FormDataType;
    value?: any;
    onChange?: (value: any) => void;
    onSelect?: (value: any, entity?: any) => void;
    placeholder?: string;
    allowClear?: boolean;
    disabled?: boolean;
    className?: string;
    mode?: "multiple" | "tags";
}

/**
 * Dynamic form data selector that fetches data via API
 * This replaces the need to load all form data in controllers
 */
const FormDataSelector: React.FC<FormDataSelectorProps> = ({
    type,
    value,
    onChange,
    onSelect,
    placeholder,
    allowClear = true,
    disabled = false,
    className,
    mode,
}) => {
    // Memoize params to ensure referential stability and prevent infinite loops
    const params = React.useMemo(
        () => ({
            paginate: false, // Most form selectors don't need pagination
            per_page: 100, // Reasonable limit for dropdown options
        }),
        []
    );

    // Only fetch data with minimal parameters to reduce unnecessary calls
    const { data, loading, error } = useFormData(type, params);
    const organizeddata = Array.isArray(data) ? data : [];
    // Generate options with better error handling and type checking
    const options = organizeddata?.map((item) => {
        let label = "Unknown";
        if (type === "packages") {
            label = item.name || "Unknown Package";
            return {
                label,
                value: item.id,
            };
        }

        // Handle different data structures
        if (item.label) {
            label = item.label;
        } else if (item.name) {
            label = item.name;
        } else if (item.type) {
            label = item.type;
        } else if (item.category_name) {
            label = item.category_name;
        } else if (item.first_name && item.last_name) {
            label = `${item.first_name} ${item.last_name}`;
        } else if (item.first_name) {
            label = item.first_name;
        } else if (item.language_name) {
            label = item.language_name;
        } else if (item.user) {
            label = item?.user?.name_salutation || item?.user?.name;
        } else if (item.client_name) {
            label = item.client_name;
        } else if (typeof item === "string") {
            label = item;
        }

        return {
            label,
            value: item.value || item.id,
        };
    });

    return (
        <Select
            className={className}
            value={value}
            onSelect={(value) =>
                onSelect?.(
                    value,
                    organizeddata.find((d: any) => (d.id || d.value) === value)
                )
            }
            onChange={onChange}
            placeholder={placeholder || `Select ${type.replace("-", " ")}`}
            allowClear={allowClear}
            loading={loading}
            disabled={disabled || loading}
            options={options}
            mode={mode}
            showSearch
            filterOption={(input, option) =>
                (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
            }
            notFoundContent={
                loading ? (
                    <Skeleton active paragraph={{ rows: 1 }} />
                ) : (
                    "No data found"
                )
            }
        />
    );
};

/**
 * Batch loader for multiple form data types
 * Useful for forms that need multiple select options
 */
export const useLeadFormData = () => {
    const { data, loading, error } = useFormDataBatch([
        "salutations",
        "employees",
        "categories",
        "sources",
        "lead-pipelines",
    ]);

    return {
        salutations: data.salutations || [],
        employees: data.employees || [],
        categories: data.categories || [],
        sources: data.sources || [],
        leadPipelines: data["lead-pipelines"] || [],
        loading,
        error,
    };
};

/**
 * Example usage component showing how to replace heavy prop-based data with API fetching
 */
export const LeadFormExample = () => {
    const [formData, setFormData] = useState({
        salutation: null,
        leadOwner: null,
        category: null,
        source: null,
        pipeline: null,
    });

    const handleFieldChange = (field: string) => (value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <div
            style={{
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "1fr 1fr",
                maxWidth: "600px",
            }}
        >
            <div>
                <label>Salutation:</label>
                <FormDataSelector
                    type="salutations"
                    value={formData.salutation}
                    onChange={handleFieldChange("salutation")}
                />
            </div>

            <div>
                <label>Lead Owner:</label>
                <FormDataSelector
                    type="employees"
                    value={formData.leadOwner}
                    onChange={handleFieldChange("leadOwner")}
                />
            </div>

            <div>
                <label>Category:</label>
                <FormDataSelector
                    type="categories"
                    value={formData.category}
                    onChange={handleFieldChange("category")}
                />
            </div>

            <div>
                <label>Source:</label>
                <FormDataSelector
                    type="sources"
                    value={formData.source}
                    onChange={handleFieldChange("source")}
                />
            </div>

            <div>
                <label>Pipeline:</label>
                <FormDataSelector
                    type="lead-pipelines"
                    value={formData.pipeline}
                    onChange={handleFieldChange("pipeline")}
                />
            </div>
        </div>
    );
};

export default FormDataSelector;

import { useState, useEffect } from "react";
import { Select, Spin, message } from "antd";
import { useFormData, useFormDataBatch } from "@/Hooks/useFormData";

interface FormDataSelectorProps {
    type:
        | "salutations"
        | "employees"
        | "categories"
        | "sources"
        | "lead-pipelines";
    value?: any;
    onChange?: (value: any) => void;
    placeholder?: string;
    allowClear?: boolean;
}

/**
 * Dynamic form data selector that fetches data via API
 * This replaces the need to load all form data in controllers
 */
const FormDataSelector: React.FC<FormDataSelectorProps> = ({
    type,
    value,
    onChange,
    placeholder,
    allowClear = true,
}) => {
    const { data, loading, error } = useFormData(type);

    useEffect(() => {
        if (error) {
            message.error(`Failed to load ${type}: ${error}`);
        }
    }, [error, type]);

    const options = data.map((item) => ({
        label:
            item.name ||
            item.label ||
            item.type ||
            item.category_name ||
            `${item.first_name} ${item.last_name}`,
        value: item.id,
    }));

    return (
        <Select
            value={value}
            onChange={onChange}
            placeholder={placeholder || `Select ${type}`}
            allowClear={allowClear}
            loading={loading}
            options={options}
            showSearch
            filterOption={(input, option) =>
                (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
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

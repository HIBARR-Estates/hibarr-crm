import React from "react";
import { Form, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import {
    HomeOutlined,
    ShopOutlined,
    EnvironmentOutlined,
    BuildOutlined,
    CheckCircleFilled,
} from "@ant-design/icons";
import type { PrimaryCategory } from "@/Types";

const { Text } = Typography;

interface CategorySelectorProps {
    form: FormInstance;
    value?: PrimaryCategory;
    onChange?: (category: PrimaryCategory) => void;
}

const CATEGORIES: {
    value: PrimaryCategory;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
}[] = [
    {
        value: "residential",
        label: "Residential",
        description: "Villas, Apartments, Townhouses and other housing",
        icon: <HomeOutlined />,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-500",
    },
    {
        value: "commercial",
        label: "Commercial",
        description: "Shops, Hotels, Offices, Warehouses and workplaces",
        icon: <ShopOutlined />,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-500",
    },
    {
        value: "land",
        label: "Land",
        description: "Zoned land, Fields, Olive Groves and plots",
        icon: <EnvironmentOutlined />,
        color: "text-amber-600",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-500",
    },
    {
        value: "construction_project",
        label: "Construction Project",
        description: "New development projects by construction companies",
        icon: <BuildOutlined />,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-500",
    },
];

/**
 * Prominent category selector rendered as 3 clickable cards.
 * The selected category drives the entire form's field visibility.
 */
const CategorySelector: React.FC<CategorySelectorProps> = ({
    form,
    value,
    onChange,
}) => {
    const handleSelect = (category: PrimaryCategory) => {
        const previousCategory = form.getFieldValue("primary_category");

        // Call the form onChange to update the form value
        onChange?.(category);

        // Reset dependent fields when category changes
        if (previousCategory && previousCategory !== category) {
            // Reset property type (may not be valid for new category)
            form.setFieldValue("property_type", undefined);
            // Reset sale type if switching to land
            if (category === "land") {
                const currentSaleType = form.getFieldValue("sale_type");
                if (
                    currentSaleType &&
                    !["For Sale"].includes(currentSaleType)
                ) {
                    form.setFieldValue("sale_type", undefined);
                }
                // Clear fields not applicable to land
                form.setFieldValue("unit_style", undefined);
                form.setFieldValue("bedrooms", undefined);
                form.setFieldValue("bathrooms", undefined);
                form.setFieldValue("living_room", undefined);
                form.setFieldValue("floor_number", undefined);
                form.setFieldValue("floors_in_building", undefined);
                form.setFieldValue("building_age", undefined);
            }
            // Clear unit style for non-residential
            if (category !== "residential") {
                form.setFieldValue("unit_style", undefined);
            }
            // Clear property-specific fields when switching to construction project
            if (category === "construction_project") {
                form.setFieldValue("property_type", undefined);
                form.setFieldValue("sale_type", undefined);
                form.setFieldValue("status", undefined);
                form.setFieldValue("unit_style", undefined);
                form.setFieldValue("bedrooms", undefined);
                form.setFieldValue("bathrooms", undefined);
                form.setFieldValue("living_room", undefined);
                form.setFieldValue("floor_number", undefined);
                form.setFieldValue("floors_in_building", undefined);
                form.setFieldValue("building_age", undefined);
                form.setFieldValue("price", undefined);
                form.setFieldValue("within_site", undefined);
            }
            // Clear construction project fields when switching away from it
            if (previousCategory === "construction_project") {
                form.setFieldValue("construction_status", undefined);
                form.setFieldValue("starting_price", undefined);
                form.setFieldValue("facilities", undefined);
                form.setFieldValue("payment_plan", undefined);
                form.setFieldValue("unit_types", undefined);
                form.setFieldValue("primary_categories", undefined);
                form.setFieldValue("google_drive_link", undefined);
                form.setFieldValue("availability_link", undefined);
            }
        }
    };

    return (
        <div>
            <div className="mb-3">
                <Text strong className="text-base">
                    What type of property is this?
                </Text>
                <Text type="secondary" className="block text-xs mt-0.5">
                    Select the category to see relevant fields
                </Text>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CATEGORIES.map((cat) => {
                    const isSelected = value === cat.value;
                    return (
                        <div
                            key={cat.value}
                            onClick={() => handleSelect(cat.value)}
                            className={`
                                relative cursor-pointer rounded-lg border-2 p-4 transition-all duration-200
                                ${
                                    isSelected
                                        ? `${cat.borderColor} ${cat.bgColor} shadow-sm`
                                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                                }
                            `}
                        >
                            {/* Selected checkmark */}
                            {isSelected && (
                                <CheckCircleFilled
                                    className={`absolute top-2.5 right-2.5 ${cat.color} text-base`}
                                />
                            )}
                            <div
                                className={`text-2xl mb-2 ${isSelected ? cat.color : "text-gray-400"}`}
                            >
                                {cat.icon}
                            </div>
                            <div
                                className={`font-semibold text-sm ${isSelected ? "text-gray-900" : "text-gray-700"}`}
                            >
                                {cat.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                {cat.description}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CategorySelector;

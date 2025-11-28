import { useState } from "react";
import { Select, Button, Spin } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import AddTaskCategoryModal from "./AddTaskCategoryModal";

interface TaskCategory {
    id: number;
    category_name: string;
}

interface Props {
    value?: number;
    onChange?: (value: number) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    allowClear?: boolean;
}

export default function TaskCategorySelector({
    value,
    onChange,
    placeholder = "Select category",
    disabled = false,
    className,
    allowClear = true,
}: Props) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const {
        data: response,
        isLoading,
        refetch,
    } = useApiQuery<{
        categories: TaskCategory[];
    }>({
        path: route("taskCategory.index"),
    });

    const categories = response?.categories || [];

    const handleAddSuccess = () => {
        refetch();
    };

    const dropdownRender = (menu: React.ReactElement) => (
        <>
            {menu}
            <div className="border-t border-gray-200 p-2">
                <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full text-left hover:bg-gray-50"
                    disabled={disabled}
                >
                    Add New Category
                </Button>
            </div>
        </>
    );

    return (
        <>
            <Select
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled || isLoading}
                className={className}
                popupRender={dropdownRender}
                showSearch
                allowClear={allowClear}
                optionFilterProp="children"
                notFoundContent={
                    isLoading ? <Spin size="small" /> : "No categories found"
                }
            >
                {categories.map((category) => (
                    <Select.Option key={category.id} value={category.id}>
                        {category.category_name}
                    </Select.Option>
                ))}
            </Select>

            <AddTaskCategoryModal
                open={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleAddSuccess}
            />
        </>
    );
}

import { useState } from "react";
import { Select, Button, Spin, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import AddTaskLabelModal from "./AddTaskLabelModal";

interface TaskLabel {
    id: number;
    label_name: string;
    label_color: string;
}

interface Props {
    value?: number[];
    onChange?: (value: number[]) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    mode?: "multiple" | "tags";
}

export default function TaskLabelSelector({
    value,
    onChange,
    placeholder = "Select labels",
    disabled = false,
    className,
    mode = "multiple",
}: Props) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const {
        data: response,
        isLoading,
        refetch,
    } = useApiQuery<{
        labels: TaskLabel[];
    }>({
        path: route("task-label.index"),
    });

    const labels = response?.labels || [];

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
                    Add New Label
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
                mode={mode}
                optionFilterProp="children"
                notFoundContent={
                    isLoading ? <Spin size="small" /> : "No labels found"
                }
            >
                {labels.map((label) => (
                    <Select.Option key={label.id} value={label.id}>
                        <Space>
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor: label.label_color,
                                    display: "inline-block",
                                }}
                            />
                            {label.label_name}
                        </Space>
                    </Select.Option>
                ))}
            </Select>

            <AddTaskLabelModal
                open={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleAddSuccess}
            />
        </>
    );
}

import { useState } from "react";
import { Select, Button, Spin } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import AddMeetingType from "./AddMeetingType";

const { Option } = Select;

interface MeetingType {
    id: number;
    name: string;
    description?: string;
    color?: string;
}

interface Props {
    value?: number;
    onChange?: (value: number) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export default function MeetingTypeSelector({
    value,
    onChange,
    placeholder = "Select meeting type",
    disabled = false,
    className,
}: Props) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Fetch meeting types from API
    const {
        data: meetingTypesResponse,
        isLoading,
        refetch,
    } = useApiQuery<{
        meeting_types: MeetingType[];
    }>({
        path: route("meeting-types.index"),
    });

    const meetingTypes = meetingTypesResponse?.meeting_types || [];

    const handleAddSuccess = (newMeetingType: MeetingType) => {
        // Refetch the meeting types to get the updated list
        refetch();
        // Auto-select the newly created meeting type
        onChange?.(newMeetingType.id);
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
                    Add New Meeting Type
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
                notFoundContent={
                    isLoading ? <Spin size="small" /> : "No meeting types found"
                }
                options={meetingTypes.map((m) => ({
                    label: m.name,
                    value: m.id,
                }))}
            />

            <AddMeetingType
                open={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleAddSuccess}
            />
        </>
    );
}

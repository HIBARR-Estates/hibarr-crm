import { useState } from "react";
import { Select, Button, Spin, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import AddMeetingType from "./AddMeetingType";

const { Option } = Select;

interface MeetingType {
    id: number;
    name: string;
    description?: string;
    color?: string;
    is_active?: boolean;
}

interface Props {
    value?: number;
    onChange?: (value: number) => void;
    platformValue?: string;
    onPlatformChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    showPlatform?: boolean;
}

export default function MeetingTypeSelector({
    value,
    onChange,
    platformValue,
    onPlatformChange,
    placeholder = "Select meeting type",
    disabled = false,
    className,
    showPlatform = true,
}: Props) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Platform options: zoho or in the office
    const platformOptions = [
        { value: "zoho", label: "Zoho" },
        { value: "office", label: "HIBARR Office" },
    ];

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

    // Filter only active meeting types
    const meetingTypes = (meetingTypesResponse?.meeting_types || []).filter(
        (type) => type.is_active === true
    );

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
            <Space.Compact className="w-full" block>
                <Select
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled || isLoading}
                    className={`flex-1 ${className || ""}`}
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
                
                {showPlatform && (
                    <Select
                        value={platformValue}
                        onChange={onPlatformChange}
                        placeholder="Platform"
                        disabled={disabled}
                        className={className || ""}
                        options={platformOptions}
                        style={{ width: 150 }}
                    />
                )}
            </Space.Compact>

            <AddMeetingType
                open={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleAddSuccess}
            />
        </>
    );
}

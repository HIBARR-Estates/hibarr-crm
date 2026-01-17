import { Select, Spin, Space } from "antd";
import { useApiQuery } from "@/lib/api/client";

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
    // Platform options: zoho or in the office
    const platformOptions = [
        { value: "zoho", label: "Video Meeting" },
        { value: "office", label: "HIBARR Office" },
        { value: "phone", label: "Phone Meeting" },
        { value: "physical", label: "Physical Meeting" },
    ];

    // Fetch meeting types from API
    const {
        data: meetingTypesResponse,
        isLoading,
    } = useApiQuery<{
        meeting_types: MeetingType[];
    }>({
        path: route("meeting-types.index"),
    });

    // Filter only active meeting types
    const meetingTypes = (meetingTypesResponse?.meeting_types || []).filter(
        (type) => type.is_active === true
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
        </>
    );
}

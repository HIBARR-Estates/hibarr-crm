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
    renderAsChips?: boolean;
    onNameChange?: (name: string) => void;
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
    renderAsChips = false,
    onNameChange,
}: Props) {
    const platformOptions = [
        { value: "zoho", label: "Video Meeting" },
        { value: "office", label: "HIBARR Office" },
        { value: "phone", label: "Phone Meeting" },
        { value: "physical", label: "Physical Meeting" },
    ];

    const { data: meetingTypesResponse, isLoading } = useApiQuery<{
        meeting_types: MeetingType[];
    }>({
        path: route("meeting-types.index"),
    });

    const meetingTypes = (meetingTypesResponse?.meeting_types || []).filter(
        (type) => type.is_active === true,
    );

    const handleChange = (id: number) => {
        onChange?.(id);
        const type = meetingTypes.find((t) => t.id === id);
        if (type) onNameChange?.(type.name);
    };

    if (renderAsChips) {
        if (isLoading) {
            return (
                <div className="flex items-center gap-2 py-1">
                    <Spin size="small" />
                    <span className="text-sm text-gray-400">Loading types…</span>
                </div>
            );
        }
        return (
            <div className="flex flex-wrap gap-2">
                {meetingTypes.map((type) => {
                    const active = value === type.id;
                    return (
                        <button
                            key={type.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleChange(type.id)}
                            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                active
                                    ? "bg-blue-500 border-blue-500 text-white"
                                    : "border-gray-300 text-gray-600 bg-white hover:border-blue-400 hover:text-blue-500"
                            }`}
                        >
                            {type.name}
                        </button>
                    );
                })}
                {meetingTypes.length === 0 && (
                    <p className="text-sm text-gray-400 italic">
                        No meeting types available
                    </p>
                )}
            </div>
        );
    }

    return (
        <>
            <Space.Compact className="w-full" block>
                <Select
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={disabled || isLoading}
                    className={`flex-1 ${className || ""}`}
                    showSearch
                    notFoundContent={
                        isLoading ? (
                            <Spin size="small" />
                        ) : (
                            "No meeting types found"
                        )
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

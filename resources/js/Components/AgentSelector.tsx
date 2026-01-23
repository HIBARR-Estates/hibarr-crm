import React, { useState, useMemo } from "react";
import { Dropdown, Avatar, Input, Spin, Empty } from "antd";
import {
    UserOutlined,
    DownOutlined,
    SearchOutlined,
    LoadingOutlined,
} from "@ant-design/icons";
import { useFormData } from "@/Hooks/useFormData";
import { useDebounce } from "@/Hooks/useDebounce";

interface LeadAgent {
    id: number;
    user_id?: number;
    name: string;
    image?: string;
    user?: {
        id: number;
        name: string;
        email?: string;
        image_url?: string;
    };
}

interface AgentSelectorProps {
    currentAgent?: {
        id: number;
        name: string;
        image_url?: string;
    } | null;
    onSelect: (agentId: number | null) => void;
    disabled?: boolean;
    size?: "small" | "default";
    placeholder?: string;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({
    currentAgent,
    onSelect,
    disabled = false,
    size = "default",
    placeholder = "Assign",
}) => {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const debouncedSearch = useDebounce(searchValue, 300);

    // Fetch agents using useFormData with search - only fetch when dropdown is open
    const { data, loading } = useFormData<LeadAgent>("lead-agents", {
        search: debouncedSearch,
        per_page: 20,
        paginate: false,
        enabled: open, // Only fetch when dropdown is open
    });

    // Ensure agents is properly typed
    const agents: LeadAgent[] = data || [];

    const handleSelect = (agentId: number | null) => {
        onSelect(agentId);
        setOpen(false);
        setSearchValue("");
    };

    const dropdownContent = (
        <div
            className="bg-white rounded-lg shadow-lg border border-gray-200 w-64 max-h-80 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-100">
                <Input
                    prefix={<SearchOutlined className="text-gray-400" />}
                    placeholder="Search agents..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    size="small"
                    allowClear
                    autoFocus
                />
            </div>

            {/* Agent List */}
            <div className="max-h-56 overflow-y-auto">
                {/* Unassign Option */}
                <div
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-gray-500 border-b border-gray-100"
                    onClick={() => handleSelect(null)}
                >
                    <Avatar size="small" icon={<UserOutlined />} />
                    <span className="text-sm">Unassign</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Spin indicator={<LoadingOutlined spin />} />
                    </div>
                ) : agents.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No agents found"
                        className="py-4"
                    />
                ) : (
                    agents.map((agent) => {
                        const agentName = agent.user?.name || agent.name;
                        const agentImage = agent.user?.image_url || agent.image;
                        const isSelected = currentAgent?.id === agent.user?.id;

                        return (
                            <div
                                key={agent.id}
                                className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                                    isSelected ? "bg-blue-50" : ""
                                }`}
                                onClick={() => handleSelect(agent.id)}
                            >
                                <Avatar
                                    size="small"
                                    src={agentImage}
                                    icon={<UserOutlined />}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                        {agentName}
                                    </div>
                                    {agent.user?.email && (
                                        <div className="text-xs text-gray-500 truncate">
                                            {agent.user.email}
                                        </div>
                                    )}
                                </div>
                                {isSelected && (
                                    <span className="text-blue-500 text-xs">
                                        ✓
                                    </span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    const isSmall = size === "small";

    return (
        <Dropdown
            dropdownRender={() => dropdownContent}
            trigger={["click"]}
            open={open}
            onOpenChange={(visible) => {
                if (!disabled) {
                    setOpen(visible);
                    if (!visible) {
                        setSearchValue("");
                    }
                }
            }}
            placement="bottomLeft"
        >
            {currentAgent ? (
                <div
                    className={`flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity ${
                        disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Avatar
                        size={isSmall ? 20 : 24}
                        src={currentAgent.image_url}
                        icon={<UserOutlined />}
                    />
                    <span
                        className={`text-gray-600 truncate ${
                            isSmall
                                ? "text-[13px] max-w-[60px]"
                                : "text-sm max-w-[100px]"
                        }`}
                    >
                        {currentAgent.name}
                    </span>
                    {!disabled && (
                        <DownOutlined
                            className="text-gray-400"
                            style={{ fontSize: isSmall ? "9px" : "10px" }}
                        />
                    )}
                </div>
            ) : (
                <div
                    className={`flex items-center gap-1 cursor-pointer ${
                        disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Avatar
                        size={isSmall ? 20 : 24}
                        icon={<UserOutlined />}
                        className="bg-gray-100"
                    />
                    <span
                        className={`text-blue-600 hover:text-blue-700 font-medium ${
                            isSmall ? "text-[13px]" : "text-sm"
                        }`}
                    >
                        {placeholder}
                    </span>
                    {!disabled && (
                        <DownOutlined
                            className="text-blue-500"
                            style={{ fontSize: isSmall ? "9px" : "10px" }}
                        />
                    )}
                </div>
            )}
        </Dropdown>
    );
};

export default AgentSelector;

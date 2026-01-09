import React from "react";
import { Button, Space, Tooltip } from "antd";
import { DeleteOutlined, CheckSquareOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";

interface BulkActionBarProps {
    selectedIds: number[];
    onAction: (action: "status" | "delete") => void;
    onClear: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
    selectedIds,
    onAction,
    onClear,
}) => {
    if (selectedIds.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center gap-6"
            >
                <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
                    <span className="font-semibold text-white">
                        {selectedIds.length}
                    </span>
                    <span className="text-gray-300">Selected</span>
                </div>

                <Space>
                    <Tooltip title="Change Status">
                        <Button
                            type="text"
                            className="text-white hover:text-blue-400 hover:bg-gray-700"
                            icon={<CheckSquareOutlined />}
                            onClick={() => onAction("status")}
                        >
                            Change Status
                        </Button>
                    </Tooltip>

                    <Tooltip title="Delete">
                        <Button
                            type="text"
                            className="text-white hover:text-red-400 hover:bg-gray-700"
                            icon={<DeleteOutlined />}
                            onClick={() => onAction("delete")}
                        >
                            Delete
                        </Button>
                    </Tooltip>
                </Space>

                <div className="border-l border-gray-600 pl-4">
                    <Button
                        type="link"
                        size="small"
                        className="text-gray-400 hover:text-white p-0"
                        onClick={onClear}
                    >
                        Cancel
                    </Button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BulkActionBar;

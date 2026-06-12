import React from "react";
import { Tag } from "antd";
import { EyeInvisibleOutlined } from "@ant-design/icons";
import { QualificationToken } from "@/Types/qualification";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import TokenHighlight from "../TokenHighlight";

interface InstructionSegmentProps {
    label: string;
    tokenMap: Record<QualificationToken, string>;
}

const InstructionSegment: React.FC<InstructionSegmentProps> = ({
    label,
    tokenMap,
}) => {
    const translated = useDynamicTranslation(label);

    return (
        <div className="space-y-4 border-2 border-dashed border-gray-300 rounded-lg p-5 bg-gray-50/50">
            <Tag
                icon={<EyeInvisibleOutlined />}
                className="text-xs uppercase tracking-wide text-gray-500 border-gray-300"
            >
                Do not read aloud
            </Tag>
            <p className="text-base leading-relaxed text-gray-600 italic">
                <TokenHighlight text={translated} tokenMap={tokenMap} />
            </p>
        </div>
    );
};

export default InstructionSegment;

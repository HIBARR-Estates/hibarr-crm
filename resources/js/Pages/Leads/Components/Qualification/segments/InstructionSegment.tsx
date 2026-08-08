import React from "react";
import { Tag } from "antd";
import { EyeInvisibleOutlined } from "@ant-design/icons";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import QualificationScriptHtml from "../QualificationScriptHtml";

interface InstructionSegmentProps {
    label: string;
    translateScript: (text: string) => string;
}

const InstructionSegment: React.FC<InstructionSegmentProps> = ({
    label,
    translateScript,
}) => {
    const translated = translateScript(
        useDynamicTranslation(label, { source: "en" }),
    );

    return (
        <div className="space-y-4 border-2 border-dashed border-gray-300 rounded-lg p-5 bg-gray-50/50">
            <Tag
                icon={<EyeInvisibleOutlined />}
                className="text-xs uppercase tracking-wide text-gray-500 border-gray-300"
            >
                Do not read aloud
            </Tag>
            <QualificationScriptHtml
                html={translated}
                className="text-base leading-relaxed text-gray-600 italic"
            />
        </div>
    );
};

export default InstructionSegment;

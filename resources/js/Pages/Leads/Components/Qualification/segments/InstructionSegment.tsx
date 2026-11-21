import React from "react";
import { Tag } from "antd";
import { EyeInvisibleOutlined } from "@ant-design/icons";
import QualificationScriptHtml from "../QualificationScriptHtml";
import { useTranslatedScriptLabel } from "../useTranslatedScriptLabel";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface InstructionSegmentProps {
    label: string;
    translateScript: (text: string) => string;
}

const InstructionSegment: React.FC<InstructionSegmentProps> = ({
    label,
    translateScript,
}) => {
    const { td } = useTd();
    const translated = translateScript(useTranslatedScriptLabel(label));

    return (
        <div className="space-y-4 border-2 border-dashed border-gray-300 rounded-lg p-5 bg-gray-50/50">
            <Tag
                icon={<EyeInvisibleOutlined />}
                className="text-xs uppercase tracking-wide text-gray-500 border-gray-300"
            >
                {td("Do not read aloud", { source: "en" })}
            </Tag>
            <QualificationScriptHtml
                html={translated}
                className="text-base leading-relaxed text-gray-600 italic"
            />
        </div>
    );
};

export default InstructionSegment;

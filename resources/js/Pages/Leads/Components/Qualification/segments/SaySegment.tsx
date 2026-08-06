import React from "react";
import { Tag } from "antd";
import { SoundOutlined } from "@ant-design/icons";
import { QualificationToken } from "@/Types/qualification";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import TokenHighlight from "../TokenHighlight";

interface SaySegmentProps {
    label: string;
    tokenMap: Record<QualificationToken, string>;
    translateScript: (text: string) => string;
}

const SaySegment: React.FC<SaySegmentProps> = ({
    label,
    tokenMap,
    translateScript,
}) => {
    const translated = translateScript(useDynamicTranslation(label, { source: "en" }));

    return (
        <div className="space-y-4">
            <Tag color="blue" icon={<SoundOutlined />} className="text-xs uppercase tracking-wide">
                Read aloud
            </Tag>
            <p className="text-xl leading-relaxed text-gray-900 font-medium">
                <TokenHighlight text={translated} tokenMap={tokenMap} />
            </p>
        </div>
    );
};

export default SaySegment;

import React from "react";
import { Tag } from "antd";
import { SoundOutlined } from "@ant-design/icons";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import QualificationScriptHtml from "../QualificationScriptHtml";

interface SaySegmentProps {
    label: string;
    translateScript: (text: string) => string;
}

const SaySegment: React.FC<SaySegmentProps> = ({ label, translateScript }) => {
    const translated = translateScript(
        useDynamicTranslation(label, { source: "en" }),
    );

    return (
        <div className="space-y-4">
            <Tag
                color="blue"
                icon={<SoundOutlined />}
                className="text-xs uppercase tracking-wide"
            >
                Read aloud
            </Tag>
            <QualificationScriptHtml
                html={translated}
                className="text-xl leading-relaxed text-gray-900 font-medium"
                quoted
            />
        </div>
    );
};

export default SaySegment;

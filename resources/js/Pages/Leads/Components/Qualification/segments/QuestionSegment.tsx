import React from "react";
import { Tag, Radio, Checkbox, Input, Switch, Space } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Segment, SegmentAnswerState } from "@/Types/qualification";
import QualificationScriptHtml from "../QualificationScriptHtml";
import { stripHtmlTags } from "../qualificationUtils";
import { useTranslatedScriptLabel } from "../useTranslatedScriptLabel";

interface QuestionSegmentProps {
    segment: Segment;
    answer?: SegmentAnswerState;
    translateScript: (text: string) => string;
    onChange: (values: string[], text?: string | null) => void;
    disabled?: boolean;
}

const QuestionSegment: React.FC<QuestionSegmentProps> = ({
    segment,
    answer,
    translateScript,
    onChange,
    disabled = false,
}) => {
    const translated = translateScript(
        useTranslatedScriptLabel(segment.label),
    );
    const answerType = segment.answerType ?? "singleSelect";

    return (
        <div className="space-y-5">
            <Tag
                color="green"
                icon={<QuestionCircleOutlined />}
                className="text-xs uppercase tracking-wide"
            >
                Ask
            </Tag>
            <div className="flex items-start gap-1">
                <QualificationScriptHtml
                    html={translated}
                    className="text-xl leading-relaxed text-gray-900 font-medium flex-1"
                    quoted
                />
                {segment.required ? (
                    <span className="text-red-500 ml-1 mt-1">*</span>
                ) : null}
            </div>

            {answerType === "singleSelect" && (
                <Radio.Group
                    value={answer?.answer_values[0]}
                    onChange={(e) => onChange([e.target.value])}
                    disabled={disabled}
                    className="w-full"
                >
                    <Space direction="vertical" className="w-full">
                        {(segment.options ?? []).map((option) => (
                            <Radio key={option.id} value={option.id}>
                                <OptionLabel label={option.label} />
                            </Radio>
                        ))}
                    </Space>
                </Radio.Group>
            )}

            {answerType === "multiSelect" && (
                <Checkbox.Group
                    value={answer?.answer_values ?? []}
                    onChange={(values) => onChange(values as string[])}
                    disabled={disabled}
                    className="w-full"
                >
                    <Space direction="vertical" className="w-full">
                        {(segment.options ?? []).map((option) => (
                            <Checkbox key={option.id} value={option.id}>
                                <OptionLabel label={option.label} />
                            </Checkbox>
                        ))}
                    </Space>
                </Checkbox.Group>
            )}

            {answerType === "text" && (
                <Input.TextArea
                    value={answer?.answer_text ?? ""}
                    onChange={(e) => onChange([], e.target.value)}
                    disabled={disabled}
                    rows={3}
                    placeholder="Enter answer..."
                />
            )}

            {answerType === "boolean" && (
                <Switch
                    checked={answer?.answer_values[0] === "true"}
                    onChange={(checked) =>
                        onChange([checked ? "true" : "false"])
                    }
                    disabled={disabled}
                    checkedChildren="Yes"
                    unCheckedChildren="No"
                />
            )}
        </div>
    );
};

const OptionLabel: React.FC<{ label: string }> = ({ label }) => {
    const translated = useTranslatedScriptLabel(label);
    return <>{stripHtmlTags(translated) || translated}</>;
};

export default QuestionSegment;

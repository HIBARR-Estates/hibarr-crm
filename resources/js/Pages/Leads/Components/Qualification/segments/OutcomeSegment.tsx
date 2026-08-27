import React, { useMemo, useState } from "react";
import { Alert, Tag } from "antd";
import { FlagOutlined } from "@ant-design/icons";
import {
    LeadQualification,
    QualificationOutcome,
    TemplateTree,
} from "@/Types/qualification";
import { useTd } from "@/Hooks/useDynamicTranslation";
import QualificationScriptHtml from "../QualificationScriptHtml";
import OutcomeMultiSelect from "../OutcomeMultiSelect";
import { getScriptOutcomes } from "../qualificationUtils";
import { useTranslatedScriptLabel } from "../useTranslatedScriptLabel";

interface OutcomeSegmentProps {
    label: string;
    translateScript: (text: string) => string;
    templateTree: TemplateTree;
    onComplete: (
        outcomes: QualificationOutcome[],
        metadata?: {
            comment?: string | null;
        },
    ) => Promise<LeadQualification | void | null>;
    loading?: boolean;
}

const OutcomeSegment: React.FC<OutcomeSegmentProps> = ({
    label,
    translateScript,
    templateTree,
    onComplete,
    loading = false,
}) => {
    const translated = translateScript(useTranslatedScriptLabel(label));
    const { td } = useTd();
    const [error, setError] = useState<string | null>(null);
    const scriptOutcomes = useMemo(
        () => getScriptOutcomes(templateTree),
        [templateTree],
    );

    const handleConfirm = async (
        outcomes: QualificationOutcome[],
        comment: string | null,
    ) => {
        setError(null);
        try {
            await onComplete(outcomes, { comment });
        } catch (outcomeError) {
            setError(
                outcomeError instanceof Error
                    ? outcomeError.message
                    : "Failed to complete outcome",
            );
        }
    };

    return (
        <div className="space-y-5">
            <Tag
                color="purple"
                icon={<FlagOutlined />}
                className="text-xs uppercase tracking-wide"
            >
                Close
            </Tag>
            <QualificationScriptHtml
                html={translated}
                className="text-xl leading-relaxed text-gray-900 font-medium"
                quoted
            />
            <p className="text-sm text-gray-500">
                {td("Select one or more outcomes for this lead.", {
                    source: "en",
                })}
            </p>
            {error && (
                <Alert type="error" message={error} showIcon className="mb-2" />
            )}
            <OutcomeMultiSelect
                options={scriptOutcomes}
                variant="legacy"
                completing={loading}
                onConfirm={(outcomes, comment) =>
                    handleConfirm(outcomes, comment)
                }
            />
        </div>
    );
};

export default OutcomeSegment;

import React, { useState } from "react";
import { Button, Tag } from "antd";
import {
    CalendarOutlined,
    CloseCircleOutlined,
    PhoneOutlined,
    VideoCameraOutlined,
} from "@ant-design/icons";
import {
    OutcomeMetadata,
    QualificationOutcome,
    QualificationToken,
} from "@/Types/qualification";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import TokenHighlight from "../TokenHighlight";

interface OutcomeSegmentProps {
    label: string;
    outcomeMetadata?: OutcomeMetadata;
    tokenMap: Record<QualificationToken, string>;
    onOutcome: (
        outcome: QualificationOutcome,
        metadata?: { webinarSessionId?: string; calendlyUrl?: string },
    ) => Promise<void>;
    onOpenWebinarPicker?: (webinarId: string) => void;
    loading?: boolean;
}

const OUTCOME_CONFIG: Record<
    QualificationOutcome,
    {
        label: string;
        icon: React.ReactNode;
        type?: "primary" | "default" | "dashed";
    }
> = {
    bookMeeting: {
        label: "Book consultation",
        icon: <CalendarOutlined />,
        type: "primary",
    },
    inviteWebinar: {
        label: "Invite to webinar",
        icon: <VideoCameraOutlined />,
        type: "primary",
    },
    callback: {
        label: "Schedule callback",
        icon: <PhoneOutlined />,
    },
    noFit: {
        label: "Not a fit",
        icon: <CloseCircleOutlined />,
        type: "dashed",
    },
};

const OutcomeSegment: React.FC<OutcomeSegmentProps> = ({
    label,
    outcomeMetadata,
    tokenMap,
    onOutcome,
    onOpenWebinarPicker,
    loading = false,
}) => {
    const translated = useDynamicTranslation(label);
    const [acting, setActing] = useState(false);
    const outcomeType = outcomeMetadata?.type;
    const config = outcomeType ? OUTCOME_CONFIG[outcomeType] : null;

    const handleClick = async () => {
        if (!outcomeType) return;

        if (outcomeType === "inviteWebinar" && outcomeMetadata?.webinarId) {
            onOpenWebinarPicker?.(outcomeMetadata.webinarId);
            return;
        }

        setActing(true);
        try {
            await onOutcome(outcomeType, {
                calendlyUrl: outcomeMetadata?.calendlyUrl,
            });
        } finally {
            setActing(false);
        }
    };

    return (
        <div className="space-y-5">
            <Tag color="purple" className="text-xs uppercase tracking-wide">
                Close
            </Tag>
            <p className="text-xl leading-relaxed text-gray-900 font-medium">
                <TokenHighlight text={translated} tokenMap={tokenMap} />
            </p>
            {config && outcomeType && (
                <Button
                    type={config.type ?? "default"}
                    icon={config.icon}
                    size="large"
                    loading={loading || acting}
                    onClick={handleClick}
                >
                    {outcomeMetadata?.label ?? config.label}
                </Button>
            )}
        </div>
    );
};

export default OutcomeSegment;

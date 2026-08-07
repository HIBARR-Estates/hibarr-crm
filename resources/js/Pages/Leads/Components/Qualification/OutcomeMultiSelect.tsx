import { useMemo, useState } from "react";
import { Button, Checkbox, Input, Space } from "antd";
import type {
    QualificationOutcome,
    ScriptOutcomeOption,
} from "@/Types/qualification";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";

export interface OutcomeMultiSelectProps {
    options: ScriptOutcomeOption[];
    variant?: "redesign" | "legacy";
    completing?: boolean;
    onConfirm: (
        outcomes: QualificationOutcome[],
        comment: string | null,
        meta: { calendlyUrl?: string; webinarId?: string },
    ) => void | Promise<void>;
}

export default function OutcomeMultiSelect({
    options,
    variant = "redesign",
    completing = false,
    onConfirm,
}: OutcomeMultiSelectProps) {
    const { td } = useTd();
    const [selected, setSelected] = useState<QualificationOutcome[]>([]);
    const [comment, setComment] = useState("");

    const selectedMeta = useMemo(() => {
        let calendlyUrl: string | undefined;
        let webinarId: string | undefined;
        options.forEach((option) => {
            if (!selected.includes(option.key)) return;
            if (option.calendlyUrl) calendlyUrl = option.calendlyUrl;
            if (option.webinarId) webinarId = option.webinarId;
        });
        return { calendlyUrl, webinarId };
    }, [options, selected]);

    const toggle = (key: QualificationOutcome) => {
        setSelected((prev) =>
            prev.includes(key)
                ? prev.filter((item) => item !== key)
                : [...prev, key],
        );
    };

    const handleConfirm = () => {
        void Promise.resolve(
            onConfirm(
                selected,
                comment.trim() ? comment.trim() : null,
                selectedMeta,
            ),
        ).catch(() => {
            // Caller surfaces errors (toast); avoid unhandled rejection.
        });
    };

    if (variant === "legacy") {
        return (
            <div className="space-y-4">
                <Checkbox.Group
                    value={selected}
                    onChange={(values) =>
                        setSelected(values as QualificationOutcome[])
                    }
                    disabled={completing}
                    className="w-full"
                >
                    <Space direction="vertical" className="w-full">
                        {options.map((option) => (
                            <Checkbox key={option.key} value={option.key}>
                                {td(option.label)}
                            </Checkbox>
                        ))}
                    </Space>
                </Checkbox.Group>
                <Input.TextArea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={completing}
                    rows={2}
                    placeholder={td("Add context for this outcome...")}
                />
                <Button
                    type="primary"
                    size="large"
                    loading={completing}
                    disabled={selected.length === 0}
                    onClick={handleConfirm}
                >
                    {td("Complete qualification")}
                </Button>
            </div>
        );
    }

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 14,
                }}
            >
                {options.map((option) => {
                    const isSelected = selected.includes(option.key);
                    return (
                        <button
                            key={option.key}
                            type="button"
                            className={`v2-option${isSelected ? " selected" : ""}`}
                            disabled={completing}
                            onClick={() => toggle(option.key)}
                        >
                            <span>{td(option.label)}</span>
                            {isSelected ? <Icon name="check" size={16} /> : null}
                        </button>
                    );
                })}
            </div>
            <input
                className="v2-input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={completing}
                placeholder={td("Add context for this outcome...")}
                style={{ marginBottom: 14 }}
            />
            <button
                type="button"
                className="v2-btn v2-btn-primary"
                disabled={completing || selected.length === 0}
                onClick={handleConfirm}
                style={{ width: "100%" }}
            >
                <Icon name="check" size={14} />
                {td("Complete qualification")}
            </button>
        </div>
    );
}

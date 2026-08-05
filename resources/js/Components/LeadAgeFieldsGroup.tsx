import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Input, InputNumber, Select, Spin, message } from "antd";
import {
    CheckOutlined,
    CloseOutlined,
    LoadingOutlined,
} from "@ant-design/icons";
import {
    computeAgeFieldsFromDateOfBirth,
    computeAgeRangeFromAge,
    formatLeadAgeDisplay,
    isValidDateOfBirth,
} from "@/lib/leadAge";
import { DetailFieldEditContext } from "./DetailSection";

export interface LeadAgeFieldsGroupProps {
    dateOfBirth: string | null;
    age: number | null;
    ageRange: string | null;
    ageRangeOptions: Array<{ value: string; label: string }>;
    resolveAgeRangeLabel: (value: string) => string;
    alwaysEditing?: boolean;
    disabled?: boolean;
    loading?: boolean;
    onSave?: (values: {
        date_of_birth: string | null;
        age: number | null;
        age_range: string | null;
    }) => Promise<void>;
    onChange?: (fieldName: string, value: any) => void;
}

function normalizeDateValue(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return value.split("T")[0];
}

function buildPayload(
    draftDateOfBirth: string,
    draftAge: number | null,
    draftAgeRange: string | null,
) {
    if (draftDateOfBirth) {
        const computed = computeAgeFieldsFromDateOfBirth(draftDateOfBirth);

        return {
            date_of_birth: draftDateOfBirth,
            age: computed.age,
            age_range: computed.age_range,
        };
    }

    return {
        date_of_birth: null,
        age: draftAge,
        age_range: draftAgeRange,
    };
}

export default function LeadAgeFieldsGroup({
    dateOfBirth,
    age,
    ageRange,
    ageRangeOptions,
    resolveAgeRangeLabel,
    alwaysEditing = false,
    disabled = false,
    loading = false,
    onSave,
    onChange,
}: LeadAgeFieldsGroupProps) {
    const detailFieldCtx = useContext(DetailFieldEditContext);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draftDateOfBirth, setDraftDateOfBirth] = useState("");
    const [draftAge, setDraftAge] = useState<number | null>(null);
    const [draftAgeRange, setDraftAgeRange] = useState<string | null>(null);
    const startEditingRef = useRef<() => void>(() => {});
    const containerRef = useRef<HTMLDivElement>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isClickingActionRef = useRef(false);

    const syncDraftFromProps = useCallback(() => {
        setDraftDateOfBirth(normalizeDateValue(dateOfBirth));
        setDraftAge(age);
        setDraftAgeRange(ageRange);
    }, [dateOfBirth, age, ageRange]);

    useEffect(() => {
        if (alwaysEditing) {
            syncDraftFromProps();
        }
    }, [alwaysEditing, syncDraftFromProps, dateOfBirth, age, ageRange]);

    const ageAndRangeReadOnly = useMemo(() => {
        const useDraft = alwaysEditing || isEditing;
        const effectiveDateOfBirth = useDraft
            ? draftDateOfBirth || null
            : dateOfBirth ?? null;

        return isValidDateOfBirth(effectiveDateOfBirth);
    }, [alwaysEditing, isEditing, draftDateOfBirth, dateOfBirth]);

    const displayText = useMemo(
        () =>
            formatLeadAgeDisplay(
                { dateOfBirth, age, ageRange },
                resolveAgeRangeLabel,
            ),
        [dateOfBirth, age, ageRange, resolveAgeRangeLabel],
    );

    const exitInlineEdit = useCallback(() => {
        setIsEditing(false);
        detailFieldCtx?.setIsEditing(false);
    }, [detailFieldCtx]);

    const handleInlineCancel = useCallback(() => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        isClickingActionRef.current = false;
        syncDraftFromProps();
        exitInlineEdit();
    }, [exitInlineEdit, syncDraftFromProps]);

    const handleInlineSave = useCallback(async () => {
        if (!onSave || alwaysEditing || !isEditing) {
            return;
        }

        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        const payload = buildPayload(
            draftDateOfBirth,
            draftAge,
            draftAgeRange,
        );
        const currentPayload = buildPayload(
            normalizeDateValue(dateOfBirth),
            age,
            ageRange,
        );

        const unchanged =
            payload.date_of_birth === currentPayload.date_of_birth &&
            payload.age === currentPayload.age &&
            payload.age_range === currentPayload.age_range;

        if (unchanged) {
            exitInlineEdit();
            return;
        }

        setSaving(true);

        try {
            await onSave(payload);
            exitInlineEdit();
            message.success("Field updated successfully");
        } catch (error: any) {
            message.error(
                error?.message || "Failed to update field. Please try again.",
            );
        } finally {
            setSaving(false);
        }
    }, [
        alwaysEditing,
        age,
        ageRange,
        dateOfBirth,
        draftAge,
        draftAgeRange,
        draftDateOfBirth,
        exitInlineEdit,
        isEditing,
        onSave,
    ]);

    const scheduleInlineSave = useCallback(() => {
        if (alwaysEditing || !isEditing) {
            return;
        }

        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
        }

        blurTimeoutRef.current = setTimeout(() => {
            if (!isClickingActionRef.current) {
                void handleInlineSave();
            }

            isClickingActionRef.current = false;
            blurTimeoutRef.current = null;
        }, 100);
    }, [alwaysEditing, handleInlineSave, isEditing]);

    const handleActionMouseDown = () => {
        isClickingActionRef.current = true;
    };

    const startEditing = useCallback(() => {
        if (disabled || alwaysEditing || loading || saving) {
            return;
        }

        syncDraftFromProps();
        setIsEditing(true);
        detailFieldCtx?.setIsEditing(true);
    }, [
        alwaysEditing,
        detailFieldCtx,
        disabled,
        loading,
        saving,
        syncDraftFromProps,
    ]);

    startEditingRef.current = startEditing;

    useEffect(() => {
        if (alwaysEditing || disabled) {
            detailFieldCtx?.setEditHandler(null);
            return;
        }

        if (!isEditing) {
            detailFieldCtx?.setEditHandler(() => startEditingRef.current());
        } else {
            detailFieldCtx?.setEditHandler(null);
        }

        detailFieldCtx?.setIsEditing(isEditing);

        return () => {
            detailFieldCtx?.setEditHandler(null);
            detailFieldCtx?.setIsEditing(false);
        };
    }, [alwaysEditing, detailFieldCtx, disabled, isEditing]);

    useEffect(
        () => () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        },
        [],
    );

    const applyDateOfBirthChange = (value: string) => {
        setDraftDateOfBirth(value);

        if (value) {
            const computed = computeAgeFieldsFromDateOfBirth(value);
            setDraftAge(computed.age);
            setDraftAgeRange(computed.age_range);

            if (alwaysEditing) {
                onChange?.("date_of_birth", value);
                onChange?.("age", computed.age);
                onChange?.("age_range", computed.age_range);
            }

            return;
        }

        if (alwaysEditing) {
            onChange?.("date_of_birth", null);
            onChange?.("age", null);
            onChange?.("age_range", null);
        }

        setDraftAge(null);
        setDraftAgeRange(null);
    };

    const applyAgeChange = (value: number | null) => {
        const nextAgeRange =
            !draftDateOfBirth && value != null
                ? computeAgeRangeFromAge(value)
                : draftAgeRange;

        setDraftAge(value);

        if (!draftDateOfBirth && nextAgeRange !== draftAgeRange) {
            setDraftAgeRange(nextAgeRange);
        }

        if (alwaysEditing) {
            onChange?.("age", value);

            if (!draftDateOfBirth && nextAgeRange !== draftAgeRange) {
                onChange?.("age_range", nextAgeRange);
            }
        }
    };

    const applyAgeRangeChange = (value: string | null) => {
        setDraftAgeRange(value);

        if (alwaysEditing) {
            onChange?.("age_range", value);
        }
    };

    const handleContainerBlur = (event: React.FocusEvent<HTMLDivElement>) => {
        if (alwaysEditing || !isEditing) {
            return;
        }

        const nextTarget = event.relatedTarget as Node | null;

        if (nextTarget && containerRef.current?.contains(nextTarget)) {
            return;
        }

        scheduleInlineSave();
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (alwaysEditing || !isEditing) {
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            void handleInlineSave();
        } else if (event.key === "Escape") {
            event.preventDefault();
            handleInlineCancel();
        }
    };

    const showEditFields = (alwaysEditing && !disabled) || isEditing;
    const isLocked = loading || saving;

    const renderEditFields = () => (
        <div className="flex items-end gap-2 w-full">
            <div className="flex-1 grid grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] gap-2 min-w-0">
                <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 leading-none">
                        Date of Birth
                    </span>
                    <Input
                        type="date"
                        value={draftDateOfBirth}
                        onChange={(event) =>
                            applyDateOfBirthChange(event.target.value)
                        }
                        onKeyDown={handleKeyDown}
                        className="w-full"
                        disabled={isLocked}
                    />
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 leading-none">
                        Age
                    </span>
                    <InputNumber
                        className="!w-full"
                        min={0}
                        max={300}
                        value={draftAge ?? undefined}
                        onChange={(value) =>
                            applyAgeChange(
                                value === null ? null : Number(value),
                            )
                        }
                        onKeyDown={handleKeyDown}
                        disabled={isLocked || ageAndRangeReadOnly}
                    />
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 leading-none">
                        Age Range
                    </span>
                    <Select
                        className="w-full"
                        allowClear
                        placeholder="Select age range"
                        value={draftAgeRange ?? undefined}
                        options={ageRangeOptions}
                        onChange={(value) =>
                            applyAgeRangeChange(value ?? null)
                        }
                        // Portal to body — parent DetailField/DetailSection use
                        // overflow-hidden and would clip the dropdown.
                        getPopupContainer={() => document.body}
                        listHeight={256}
                        popupMatchSelectWidth={false}
                        dropdownStyle={{ minWidth: 160, zIndex: 1100 }}
                        disabled={isLocked || ageAndRangeReadOnly}
                    />
                </div>
            </div>

            {!alwaysEditing && (
                <>
                    <button
                        type="button"
                        aria-label="Save"
                        disabled={isLocked}
                        onMouseDown={handleActionMouseDown}
                        onClick={() => void handleInlineSave()}
                        className={`flex-shrink-0 mb-2 border-0 bg-transparent p-0 leading-none ${
                            isLocked
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer text-green-600 hover:text-green-700"
                        }`}
                    >
                        <CheckOutlined />
                    </button>
                    <button
                        type="button"
                        aria-label="Cancel"
                        disabled={isLocked}
                        onMouseDown={handleActionMouseDown}
                        onClick={handleInlineCancel}
                        className={`flex-shrink-0 mb-2 border-0 bg-transparent p-0 leading-none ${
                            isLocked
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer text-red-600 hover:text-red-700"
                        }`}
                    >
                        <CloseOutlined />
                    </button>
                </>
            )}
        </div>
    );

    if (showEditFields) {
        return (
            <Spin
                spinning={isLocked}
                indicator={<LoadingOutlined spin />}
                size="small"
                wrapperClassName="w-full"
            >
                <div
                    ref={containerRef}
                    className="w-full"
                    onBlur={handleContainerBlur}
                >
                    {renderEditFields()}
                </div>
            </Spin>
        );
    }

    return (
        <div
            className={`w-full min-h-[1.5rem] flex items-center ${
                disabled || isLocked
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
            }`}
            onDoubleClick={disabled || isLocked ? undefined : startEditing}
        >
            <span className="text-[15px] text-gray-900 break-words whitespace-normal">
                {displayText ? (
                    displayText
                ) : (
                    <span className="text-gray-400">--</span>
                )}
            </span>
        </div>
    );
}

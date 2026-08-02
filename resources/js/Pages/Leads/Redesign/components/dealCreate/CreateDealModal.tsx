import { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    Button,
    Modal,
    ModalField,
} from "@/Components/Redesign";
import {
    deriveDealValue,
    type DealValueCatalogItem,
} from "../../adapters/dealValueAdapter";
import type { LeadDealCreateInput } from "../../hooks/useLeadDealCreate";

export interface LeadDealMeta {
    categories?: Array<{ id: number; category_name?: string; name?: string }>;
    packages?: Array<{
        id: number;
        name: string;
        default_value?: number;
        value?: number;
    }>;
    products?: Array<{ id: number; name: string; price?: number }>;
    pipelines?: Array<{ id: number; name: string; default_stage_id?: number }>;
    stages?: Array<{
        id: number;
        name: string;
        slug?: string;
        lead_pipeline_id?: number;
    }>;
    leadAgents?: Array<{
        id: number;
        user_id?: number;
        user?: { id: number; name: string };
    }>;
}

interface CreateDealModalProps {
    open: boolean;
    onClose: () => void;
    saving: boolean;
    errors: string[];
    dealMeta?: LeadDealMeta;
    defaultAgentId?: number | null;
    meetingTypes?: Array<{ id: number; name: string; color?: string }>;
    onSubmit: (input: LeadDealCreateInput) => void;
}

function toCatalogItems(
    items: Array<{ id: number; name: string; price?: number; default_value?: number; value?: number }> | undefined,
    priceKey: "price" | "default_value",
): DealValueCatalogItem[] {
    return (items ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        ...(priceKey === "price"
            ? { price: item.price }
            : { defaultValue: item.default_value ?? item.value }),
    }));
}

export default function CreateDealModal({
    open,
    onClose,
    saving,
    errors,
    dealMeta,
    defaultAgentId,
    meetingTypes = [],
    onSubmit,
}: CreateDealModalProps) {
    const { td } = useTd();
    const { props } = usePage();

    const categories = dealMeta?.categories ?? [];
    const packages = dealMeta?.packages ?? [];
    const products = dealMeta?.products ?? [];
    const pipelines = dealMeta?.pipelines ?? [];
    const stages = dealMeta?.stages ?? [];
    const agents = dealMeta?.leadAgents ?? [];

    const [name, setName] = useState("");
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [packageId, setPackageId] = useState<number | null>(null);
    const [productId, setProductId] = useState<number | null>(null);
    const [pipelineId, setPipelineId] = useState<number | null>(
        pipelines[0]?.id ?? null,
    );
    const [stageId, setStageId] = useState<number | null>(null);
    const [agentId, setAgentId] = useState<number | null>(
        defaultAgentId ?? null,
    );
    const [manualValue, setManualValue] = useState("");
    const [addKickoffMeeting, setAddKickoffMeeting] = useState(true);
    const [kickoffDate, setKickoffDate] = useState("");
    const [kickoffTime, setKickoffTime] = useState("10:00");
    const [kickoffMeetingTypeId, setKickoffMeetingTypeId] = useState<
        number | null
    >(meetingTypes[0]?.id ?? null);

    const derived = useMemo(
        () =>
            deriveDealValue(
                packageId,
                productId,
                toCatalogItems(packages, "default_value"),
                toCatalogItems(products, "price"),
            ),
        [packageId, productId, packages, products],
    );

    const valueLocked = derived.source !== "manual";
    const displayValue =
        derived.value != null ? String(derived.value) : manualValue;

    const pipelineStages = useMemo(
        () =>
            stages.filter(
                (stage) =>
                    !pipelineId ||
                    stage.lead_pipeline_id == null ||
                    stage.lead_pipeline_id === pipelineId,
            ),
        [pipelineId, stages],
    );

    useEffect(() => {
        if (!open) return;
        setName("");
        setCategoryId(null);
        setPackageId(null);
        setProductId(null);
        setPipelineId(pipelines[0]?.id ?? null);
        setAgentId(defaultAgentId ?? null);
        setManualValue("");
        setAddKickoffMeeting(true);
        setKickoffDate("");
        setKickoffTime("10:00");
        setKickoffMeetingTypeId(meetingTypes[0]?.id ?? null);
    }, [open, pipelines, defaultAgentId, meetingTypes]);

    useEffect(() => {
        if (pipelineStages.length === 0) {
            setStageId(null);
            return;
        }
        const defaultStage =
            pipelines.find((p) => p.id === pipelineId)?.default_stage_id ??
            pipelineStages[0]?.id;
        setStageId(defaultStage ?? pipelineStages[0]?.id ?? null);
    }, [pipelineId, pipelineStages, pipelines]);

    const handleSubmit = () => {
        const numericValue = valueLocked
            ? derived.value != null
                ? Number(derived.value)
                : null
            : manualValue.trim()
              ? Number(manualValue)
              : null;

        const productLabel = products.find((p) => p.id === productId)?.name;
        const packageLabel = packages.find((p) => p.id === packageId)?.name;
        const categoryLabel = categories.find((c) => c.id === categoryId)
            ?.category_name ?? categories.find((c) => c.id === categoryId)?.name;
        const resolvedName =
            name.trim() ||
            productLabel ||
            packageLabel ||
            categoryLabel ||
            "New deal";

        const endHour = Number(kickoffTime.split(":")[0] ?? 10);
        const endMinute = Number(kickoffTime.split(":")[1] ?? 0);
        const endTotal = endHour * 60 + endMinute + 30;
        const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;

        onSubmit({
            name: resolvedName,
            categoryId,
            packageId,
            productId,
            pipelineId,
            stageId,
            agentId,
            value: numericValue,
            valueSource: valueLocked ? "calculated" : "manual",
            addKickoffMeeting:
                addKickoffMeeting && Boolean(kickoffDate && kickoffMeetingTypeId),
            kickoffMeeting:
                addKickoffMeeting && kickoffDate && kickoffMeetingTypeId
                    ? {
                          meetingTypeId: kickoffMeetingTypeId,
                          date: kickoffDate,
                          startTime: kickoffTime,
                          endTime,
                          duration: 30,
                          platform: "zoho",
                          meetingLink: "",
                          participants: props.auth?.user?.id
                              ? [props.auth.user.id]
                              : [],
                          remark: `Kickoff for ${resolvedName}`,
                          reminders: [],
                      }
                    : undefined,
        });
    };

    const metaMissing = !dealMeta;

    return (
        <Modal
            open={open}
            title={td("Create deal")}
            onClose={() => {
                if (!saving) onClose();
            }}
            dirty={
                Boolean(name.trim()) ||
                packageId != null ||
                productId != null ||
                categoryId != null
            }
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>
                        {td("Cancel")}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={saving}
                        disabled={
                            saving ||
                            metaMissing ||
                            (addKickoffMeeting &&
                                (!kickoffDate || !kickoffMeetingTypeId))
                        }
                    >
                        {addKickoffMeeting
                            ? td("Create deal + meeting")
                            : td("Create deal")}
                    </Button>
                </>
            }
        >
            {metaMissing && (
                <p className="mb-3 text-xs text-[#b45309]">
                    {td(
                        "Deal options are still loading — try again in a moment.",
                    )}
                </p>
            )}

            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error) => (
                        <p key={error} className="text-xs text-red-600">
                            {error}
                        </p>
                    ))}
                </div>
            )}

            <ModalField label={td("Deal name")}>
                <input
                    className="v2-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={td(
                        "Optional — defaults from property/package",
                    )}
                />
            </ModalField>

            <ModalField label={td("Category")}>
                <select
                    className="v2-input"
                    value={categoryId ?? ""}
                    onChange={(e) =>
                        setCategoryId(
                            e.target.value ? Number(e.target.value) : null,
                        )
                    }
                >
                    <option value="">{td("Select category")}</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.category_name ?? cat.name}
                        </option>
                    ))}
                </select>
            </ModalField>

            <ModalField label={td("Package")}>
                <select
                    className="v2-input"
                    value={packageId ?? ""}
                    onChange={(e) =>
                        setPackageId(
                            e.target.value ? Number(e.target.value) : null,
                        )
                    }
                >
                    <option value="">{td("None")}</option>
                    {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                            {pkg.name}
                        </option>
                    ))}
                </select>
            </ModalField>

            <ModalField label={td("Property / product")}>
                <select
                    className="v2-input"
                    value={productId ?? ""}
                    onChange={(e) =>
                        setProductId(
                            e.target.value ? Number(e.target.value) : null,
                        )
                    }
                >
                    <option value="">{td("None")}</option>
                    {products.map((product) => (
                        <option key={product.id} value={product.id}>
                            {product.name}
                        </option>
                    ))}
                </select>
            </ModalField>

            <ModalField label={td("Value")}>
                {valueLocked && derived.label && (
                    <p className="mb-1 text-[11px] text-[#6b7280]">
                        {td(`Derived from ${derived.label}`)}
                    </p>
                )}
                <input
                    className="v2-input"
                    type="number"
                    min={0}
                    value={displayValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    disabled={valueLocked}
                    placeholder={props.default_currency_code ?? "TRY"}
                />
            </ModalField>

            <div className="mb-3 grid grid-cols-2 gap-3">
                <ModalField label={td("Pipeline")}>
                    <select
                        className="v2-input"
                        value={pipelineId ?? ""}
                        onChange={(e) =>
                            setPipelineId(
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                    >
                        {pipelines.map((pipeline) => (
                            <option key={pipeline.id} value={pipeline.id}>
                                {pipeline.name}
                            </option>
                        ))}
                    </select>
                </ModalField>
                <ModalField label={td("Stage")}>
                    <select
                        className="v2-input"
                        value={stageId ?? ""}
                        onChange={(e) =>
                            setStageId(
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                    >
                        {pipelineStages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                                {stage.name}
                            </option>
                        ))}
                    </select>
                </ModalField>
            </div>

            <ModalField label={td("Agent")}>
                <select
                    className="v2-input"
                    value={agentId ?? ""}
                    onChange={(e) =>
                        setAgentId(
                            e.target.value ? Number(e.target.value) : null,
                        )
                    }
                >
                    <option value="">{td("Unassigned")}</option>
                    {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                            {agent.user?.name ?? `Agent #${agent.id}`}
                        </option>
                    ))}
                </select>
            </ModalField>

            <label className="mb-2 flex cursor-pointer items-center gap-2 text-[13px] text-[#1a1f2e]">
                <input
                    type="checkbox"
                    checked={addKickoffMeeting}
                    onChange={(e) => setAddKickoffMeeting(e.target.checked)}
                />
                {td("Add consultation / kickoff meeting")}
            </label>

            {addKickoffMeeting && (
                <div className="mb-1 grid grid-cols-2 gap-3">
                    <ModalField label={td("When")}>
                        <input
                            className="v2-input"
                            type="date"
                            value={kickoffDate}
                            onChange={(e) => setKickoffDate(e.target.value)}
                        />
                    </ModalField>
                    <ModalField label={td("Start time")}>
                        <input
                            className="v2-input"
                            type="time"
                            value={kickoffTime}
                            onChange={(e) => setKickoffTime(e.target.value)}
                        />
                    </ModalField>
                    <ModalField label={td("Meeting type")}>
                        <select
                            className="v2-input"
                            value={kickoffMeetingTypeId ?? ""}
                            onChange={(e) =>
                                setKickoffMeetingTypeId(
                                    e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                )
                            }
                        >
                            <option value="">{td("Select type")}</option>
                            {meetingTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>
                    </ModalField>
                </div>
            )}
        </Modal>
    );
}

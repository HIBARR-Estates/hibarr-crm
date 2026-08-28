import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    AgentPicker,
    Avatar,
    Button,
    Icon,
    MenuSelect,
    Modal,
    ModalField,
    Switch,
    initialsFromName,
    useFloatingMenuPosition,
    type AgentOption,
    type MenuOption,
} from "@/Components/Redesign";
import MeetingFormFields from "@/Components/Redesign/meeting/MeetingFormFields";
import {
    addMinutesToTime,
    buildEmptyMeetingForm,
    requiresManualMeetingLink,
    requiresMeetingParticipants,
    requiresPhysicalLocationDetail,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import {
    deriveDealValue,
    type DealValueCatalogItem,
} from "../../adapters/dealValueAdapter";
import type { LeadDealCreateInput } from "../../hooks/useLeadDealCreate";

function toMenuOptions(
    items: Array<{ id: number; label: string }>,
    emptyLabel?: string,
): MenuOption[] {
    const options = items.map((item) => ({
        value: item.id,
        label: item.label,
    }));
    return emptyLabel
        ? [{ value: "", label: emptyLabel }, ...options]
        : options;
}

function parseMenuId(value: string | number): number | null {
    if (value === "" || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export interface LeadDealPackage {
    id: number;
    name: string;
    default_value?: number;
    value?: number;
    package_pipeline?: {
        pipeline_id?: number;
        default_stage_id?: number | null;
    } | null;
    packagePipeline?: {
        pipeline_id?: number;
        default_stage_id?: number | null;
    } | null;
}

export interface LeadDealMeta {
    categories?: Array<{ id: number; category_name?: string; name?: string }>;
    packages?: LeadDealPackage[];
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

type StepId = 1 | 2;

function toCatalogItems(
    items:
        | Array<{
              id: number;
              name: string;
              price?: number;
              default_value?: number;
              value?: number;
          }>
        | undefined,
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

function packagePipelineLink(pkg: LeadDealPackage) {
    return pkg.package_pipeline ?? pkg.packagePipeline ?? null;
}

function packagePipelineId(pkg: LeadDealPackage): number | null {
    const link = packagePipelineLink(pkg);
    return link?.pipeline_id != null ? Number(link.pipeline_id) : null;
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
    const authUserId = props.auth?.user?.id as number | undefined;
    const authUserEmail = props.auth?.user?.email as string | undefined;

    const categories = dealMeta?.categories ?? [];
    const packages = dealMeta?.packages ?? [];
    const products = dealMeta?.products ?? [];
    const pipelines = dealMeta?.pipelines ?? [];
    const stages = dealMeta?.stages ?? [];
    const agents = dealMeta?.leadAgents ?? [];

    const [step, setStep] = useState<StepId>(1);
    const [name, setName] = useState("");
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [packageId, setPackageId] = useState<number | null>(null);
    const [productId, setProductId] = useState<number | null>(null);
    const [pipelineId, setPipelineId] = useState<number | null>(null);
    const [stageId, setStageId] = useState<number | null>(null);
    const [agentId, setAgentId] = useState<number | null>(
        defaultAgentId ?? null,
    );
    const [agentPickerOpen, setAgentPickerOpen] = useState(false);
    const [manualValue, setManualValue] = useState("");
    const [addKickoffMeeting, setAddKickoffMeeting] = useState(false);
    const [meetingForm, setMeetingForm] = useState<MeetingFormState>(() =>
        buildEmptyMeetingForm(null, authUserId, authUserEmail),
    );
    const agentBtnRef = useRef<HTMLButtonElement>(null);
    const agentMenuRef = useRef<HTMLDivElement>(null);
    const agentFloatStyle = useFloatingMenuPosition(agentPickerOpen, agentBtnRef, {
        maxHeight: 280,
    });

    const pipelinePackages = useMemo(() => {
        if (pipelineId == null) return [];
        return packages.filter(
            (pkg) => packagePipelineId(pkg) === Number(pipelineId),
        );
    }, [packages, pipelineId]);

    const pipelineHasLinkedPackages = pipelinePackages.length > 0;
    const solePackage =
        pipelinePackages.length === 1 ? pipelinePackages[0] : null;

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

    const selectedAgent = useMemo(() => {
        if (agentId == null) return null;
        return agents.find((agent) => agent.id === agentId) ?? null;
    }, [agentId, agents]);

    const selectedAgentName =
        selectedAgent?.user?.name ??
        (agentId != null ? `Agent #${agentId}` : null);

    // Keep the kickoff meeting's default host in sync with the picked agent
    // — there's no deal/lead object yet to seed it from (the deal doesn't
    // exist until step 3), so this tracks the wizard's own agent selection
    // instead, both on initial seed and whenever the agent changes.
    useEffect(() => {
        if (!open || selectedAgent?.user?.id == null) return;
        const agentUserId = selectedAgent.user.id;
        setMeetingForm((prev) =>
            prev.hostId === agentUserId
                ? prev
                : { ...prev, hostId: agentUserId },
        );
    }, [open, selectedAgent]);

    useEffect(() => {
        if (!open) return;
        setStep(1);
        setName("");
        setCategoryId(null);
        setPackageId(null);
        setProductId(null);
        setPipelineId(null);
        setStageId(null);
        setAgentId(defaultAgentId ?? null);
        setAgentPickerOpen(false);
        setManualValue("");
        setAddKickoffMeeting(false);
        setMeetingForm({
            ...buildEmptyMeetingForm(null, authUserId, authUserEmail),
            meetingTypeId: meetingTypes[0]?.id ?? null,
            startTime: "10:00",
            endTime: addMinutesToTime("10:00", 30),
            duration: 30,
            remark: "",
        });
    }, [open, defaultAgentId, meetingTypes, authUserId, authUserEmail]);

    // When pipeline changes: stage default, package filter/auto-select, clear property if packages linked.
    useEffect(() => {
        if (!open) return;

        if (pipelineId == null) {
            setStageId(null);
            setPackageId(null);
            setProductId(null);
            return;
        }

        const linked = packages.filter(
            (pkg) => packagePipelineId(pkg) === Number(pipelineId),
        );

        if (linked.length === 1) {
            const only = linked[0];
            setPackageId(only.id);
            setProductId(null);
            const link = packagePipelineLink(only);
            const packageStageId = link?.default_stage_id ?? null;
            const pipelineDefault =
                pipelines.find((p) => p.id === pipelineId)?.default_stage_id ??
                null;
            const stagesForPipeline = stages.filter(
                (stage) =>
                    stage.lead_pipeline_id == null ||
                    stage.lead_pipeline_id === pipelineId,
            );
            setStageId(
                packageStageId ??
                    pipelineDefault ??
                    stagesForPipeline[0]?.id ??
                    null,
            );
            return;
        }

        if (linked.length > 1) {
            setPackageId((current) =>
                current != null && linked.some((pkg) => pkg.id === current)
                    ? current
                    : null,
            );
            setProductId(null);
        } else {
            setPackageId(null);
        }

        const pipelineDefault =
            pipelines.find((p) => p.id === pipelineId)?.default_stage_id ??
            null;
        const stagesForPipeline = stages.filter(
            (stage) =>
                stage.lead_pipeline_id == null ||
                stage.lead_pipeline_id === pipelineId,
        );
        setStageId(pipelineDefault ?? stagesForPipeline[0]?.id ?? null);
    }, [open, pipelineId, packages, pipelines, stages]);

    // Prefer the selected package's mapped default stage when available.
    useEffect(() => {
        if (!open || packageId == null || pipelineId == null) return;
        const pkg = packages.find((item) => item.id === packageId);
        if (!pkg) return;
        const packageStageId = packagePipelineLink(pkg)?.default_stage_id;
        if (packageStageId == null) return;
        const stageExists = stages.some(
            (stage) =>
                stage.id === packageStageId &&
                (stage.lead_pipeline_id == null ||
                    stage.lead_pipeline_id === pipelineId),
        );
        if (stageExists) {
            setStageId(packageStageId);
        }
    }, [open, packageId, pipelineId, packages, stages]);

    useEffect(() => {
        if (!agentPickerOpen) return;
        const onDocClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (agentBtnRef.current?.contains(target)) return;
            if (agentMenuRef.current?.contains(target)) return;
            setAgentPickerOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setAgentPickerOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [agentPickerOpen]);

    const patchMeeting = (patch: Partial<MeetingFormState>) => {
        setMeetingForm((prev) => ({ ...prev, ...patch }));
    };

    const handleAgentPick = (picked: AgentOption) => {
        setAgentId(picked.id);
        setAgentPickerOpen(false);
    };

    const step1Valid =
        pipelineId != null &&
        stageId != null &&
        (!pipelineHasLinkedPackages || packageId != null);

    const kickoffValid =
        !addKickoffMeeting ||
        (Boolean(meetingForm.date) &&
            Boolean(meetingForm.startTime) &&
            meetingForm.meetingTypeId != null &&
            (!requiresManualMeetingLink(meetingForm.platform) ||
                Boolean(meetingForm.meetingLink.trim())) &&
            (!requiresMeetingParticipants(meetingForm.platform) ||
                meetingForm.participants.length > 0) &&
            (!requiresPhysicalLocationDetail(meetingForm.platform) ||
                Boolean(meetingForm.locationDetail.trim())));

    const buildSubmitInput = (
        includeKickoff: boolean,
    ): LeadDealCreateInput => {
        const numericValue = valueLocked
            ? derived.value != null
                ? Number(derived.value)
                : null
            : manualValue.trim()
              ? Number(manualValue)
              : null;

        const productLabel = products.find((p) => p.id === productId)?.name;
        const packageLabel = packages.find((p) => p.id === packageId)?.name;
        const categoryLabel =
            categories.find((c) => c.id === categoryId)?.category_name ??
            categories.find((c) => c.id === categoryId)?.name;
        const resolvedName =
            name.trim() ||
            productLabel ||
            packageLabel ||
            categoryLabel ||
            "New deal";

        const duration =
            meetingForm.duration ??
            (meetingForm.startTime && meetingForm.endTime
                ? undefined
                : 30) ??
            30;
        const endTime =
            meetingForm.endTime ||
            (meetingForm.startTime
                ? addMinutesToTime(meetingForm.startTime, duration || 30)
                : "");

        return {
            name: resolvedName,
            categoryId,
            packageId,
            productId: pipelineHasLinkedPackages ? null : productId,
            pipelineId,
            stageId,
            agentId,
            value: numericValue,
            valueSource: valueLocked ? "calculated" : "manual",
            addKickoffMeeting:
                includeKickoff &&
                addKickoffMeeting &&
                Boolean(meetingForm.date && meetingForm.meetingTypeId),
            kickoffMeeting:
                includeKickoff &&
                addKickoffMeeting &&
                meetingForm.date &&
                meetingForm.meetingTypeId
                    ? {
                          meetingTypeId: meetingForm.meetingTypeId,
                          date: meetingForm.date,
                          startTime: meetingForm.startTime,
                          endTime,
                          duration: duration ?? 30,
                          platform: meetingForm.platform,
                          locationDetail: meetingForm.locationDetail,
                          meetingLink: meetingForm.meetingLink,
                          participants: meetingForm.participants,
                          hostId: meetingForm.hostId,
                          remark:
                              meetingForm.remark.trim() ||
                              `Kickoff for ${resolvedName}`,
                          reminders: meetingForm.reminders,
                      }
                    : undefined,
        };
    };

    const handleCreate = (includeKickoff: boolean) => {
        if (!step1Valid) return;
        if (includeKickoff && addKickoffMeeting && !kickoffValid) return;
        onSubmit(buildSubmitInput(includeKickoff));
    };

    const metaMissing = !dealMeta;
    const dirty =
        Boolean(name.trim()) ||
        packageId != null ||
        productId != null ||
        categoryId != null ||
        pipelineId != null ||
        Boolean(meetingForm.date);

    return (
        <Modal
            open={open}
            title={td("Create deal", { source: "en" })}
            onClose={() => {
                if (!saving) onClose();
            }}
            dirty={dirty}
            footer={
                <>
                    {step === 2 ? (
                        <Button
                            variant="ghost"
                            onClick={() => setStep(1)}
                            disabled={saving}
                        >
                            {td("Back", { source: "en" })}
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={saving}
                        >
                            {td("Cancel", { source: "en" })}
                        </Button>
                    )}

                    {step === 1 ? (
                        <Button
                            variant="primary"
                            onClick={() => setStep(2)}
                            disabled={saving || metaMissing || !step1Valid}
                        >
                            {td("Next", { source: "en" })}
                        </Button>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => handleCreate(false)}
                                disabled={saving || metaMissing || !step1Valid}
                            >
                                {td("Skip meeting", { source: "en" })}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => handleCreate(true)}
                                loading={saving}
                                disabled={
                                    saving ||
                                    metaMissing ||
                                    !step1Valid ||
                                    (addKickoffMeeting && !kickoffValid)
                                }
                            >
                                {addKickoffMeeting
                                    ? td("Create deal + meeting", { source: "en" })
                                    : td("Create deal", { source: "en" })}
                            </Button>
                        </div>
                    )}
                </>
            }
        >
            <div className="mb-4">
                <div
                    className="flex gap-1.5"
                    aria-hidden
                >
                    {[1, 2].map((seg) => (
                        <div
                            key={seg}
                            style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 999,
                                background:
                                    step >= seg ? "#1a6bb5" : "#e2e5ea",
                            }}
                        />
                    ))}
                </div>
                <div className="mt-2 text-[12px] text-[#6b7280]">
                    {td("Step", { source: "en" })} {step} {td("of", { source: "en" })} 2
                    {" · "}
                    {step === 1
                        ? td("Deal details", { source: "en" })
                        : td("Kickoff meeting (optional)", { source: "en" })}
                </div>
            </div>

            {metaMissing && (
                <p className="mb-3 text-xs text-[#b45309]">
                    {td("Deal options are still loading — try again in a moment.", { source: "en" })}
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

            {step === 1 && (
                <>
                    <ModalField label={td("Pipeline", { source: "en" })}>
                        <MenuSelect
                            fullWidth
                            value={pipelineId ?? ""}
                            placeholder={td("Select pipeline", { source: "en" })}
                            options={toMenuOptions(
                                pipelines.map((pipeline) => ({
                                    id: pipeline.id,
                                    label: pipeline.name,
                                })),
                                td("Select pipeline", { source: "en" }),
                            )}
                            onChange={(value) =>
                                setPipelineId(parseMenuId(value))
                            }
                            disabled={saving || pipelines.length === 0}
                        />
                    </ModalField>

                    <ModalField label={td("Stage", { source: "en" })}>
                        <MenuSelect
                            fullWidth
                            value={stageId ?? ""}
                            placeholder={
                                pipelineId
                                    ? td("Select stage", { source: "en" })
                                    : td("Select a pipeline first", { source: "en" })
                            }
                            options={toMenuOptions(
                                pipelineStages.map((stage) => ({
                                    id: stage.id,
                                    label: stage.name,
                                })),
                                pipelineId
                                    ? td("Select stage", { source: "en" })
                                    : td("Select a pipeline first", { source: "en" }),
                            )}
                            onChange={(value) => setStageId(parseMenuId(value))}
                            disabled={saving || pipelineId == null}
                        />
                    </ModalField>

                    {pipelineHasLinkedPackages && !solePackage && (
                        <ModalField label={td("Package", { source: "en" })}>
                            <MenuSelect
                                fullWidth
                                value={packageId ?? ""}
                                placeholder={td("Select package", { source: "en" })}
                                options={toMenuOptions(
                                    pipelinePackages.map((pkg) => ({
                                        id: pkg.id,
                                        label: pkg.name,
                                    })),
                                    td("Select package", { source: "en" }),
                                )}
                                onChange={(value) =>
                                    setPackageId(parseMenuId(value))
                                }
                                disabled={saving}
                            />
                        </ModalField>
                    )}

                    {solePackage && (
                        <div
                            className="mb-4 rounded-lg px-3 py-2.5"
                            style={{
                                border: `1px solid ${T.BORDER}`,
                                background: T.SURFACE_2,
                            }}
                        >
                            <div
                                className="text-[11px] font-semibold uppercase tracking-wide"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {td("Package", { source: "en" })}
                            </div>
                            <div
                                className="mt-0.5 text-[14px] font-semibold"
                                style={{ color: T.TEXT }}
                            >
                                {solePackage.name}
                            </div>
                        </div>
                    )}

                    {!pipelineHasLinkedPackages && (
                        <>
                            <ModalField label={td("Package", { source: "en" })}>
                                <MenuSelect
                                    fullWidth
                                    value={packageId ?? ""}
                                    placeholder={td("None", { source: "en" })}
                                    options={toMenuOptions(
                                        packages
                                            .filter(
                                                (pkg) =>
                                                    packagePipelineId(pkg) ==
                                                    null,
                                            )
                                            .map((pkg) => ({
                                                id: pkg.id,
                                                label: pkg.name,
                                            })),
                                        td("None", { source: "en" }),
                                    )}
                                    onChange={(value) =>
                                        setPackageId(parseMenuId(value))
                                    }
                                    disabled={saving || pipelineId == null}
                                />
                            </ModalField>

                            <ModalField label={td("Property / product", { source: "en" })}>
                                <MenuSelect
                                    fullWidth
                                    value={productId ?? ""}
                                    placeholder={td("None", { source: "en" })}
                                    options={toMenuOptions(
                                        products.map((product) => ({
                                            id: product.id,
                                            label: product.name,
                                        })),
                                        td("None", { source: "en" }),
                                    )}
                                    onChange={(value) =>
                                        setProductId(parseMenuId(value))
                                    }
                                    disabled={saving || pipelineId == null}
                                />
                            </ModalField>
                        </>
                    )}

                    <ModalField label={td("Value", { source: "en" })}>
                        {valueLocked ? (
                            <div
                                className="rounded-lg px-3 py-2.5"
                                style={{
                                    border: `1px solid ${T.BORDER}`,
                                    background: T.SURFACE_2,
                                    minHeight: 44,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    gap: 2,
                                }}
                            >
                                <div
                                    className="text-[15px] font-semibold"
                                    style={{ color: T.TEXT }}
                                >
                                    {displayValue}
                                    {props.default_currency_code
                                        ? ` ${props.default_currency_code}`
                                        : ""}
                                </div>
                                {derived.label && (
                                    <div
                                        className="text-[11px]"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        {td(`Derived from ${derived.label}`, { source: "en" })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <input
                                type="number"
                                min={0}
                                value={manualValue}
                                onChange={(e) => setManualValue(e.target.value)}
                                disabled={pipelineId == null}
                                placeholder={
                                    props.default_currency_code ?? "TRY"
                                }
                            />
                        )}
                    </ModalField>

                    <ModalField label={td("Agent", { source: "en" })}>
                        <button
                            ref={agentBtnRef}
                            type="button"
                            style={{
                                width: "100%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                background: T.WHITE,
                                color: selectedAgentName
                                    ? T.TEXT
                                    : T.TEXT_MUTED,
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 8,
                                padding: "11px 12px",
                                minHeight: 44,
                                fontFamily: "inherit",
                                fontSize: 14,
                                fontWeight: 400,
                                lineHeight: 1.25,
                                boxSizing: "border-box",
                                cursor: saving ? "not-allowed" : "pointer",
                                opacity: saving ? 0.45 : 1,
                            }}
                            onClick={() =>
                                setAgentPickerOpen((openNow) => !openNow)
                            }
                            disabled={saving}
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                {selectedAgentName ? (
                                    <>
                                        <Avatar
                                            initials={initialsFromName(
                                                selectedAgentName,
                                            )}
                                            type="agent"
                                            size={22}
                                        />
                                        <span className="truncate">
                                            {selectedAgentName}
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ color: T.TEXT_HINT }}>
                                        {td("Select agent", { source: "en" })}
                                    </span>
                                )}
                            </span>
                            <Icon
                                name={
                                    agentPickerOpen
                                        ? "chevron-up"
                                        : "chevron-down"
                                }
                                size={12}
                                color={T.TEXT_MUTED}
                            />
                        </button>
                        {agentPickerOpen &&
                            agentFloatStyle &&
                            typeof document !== "undefined" &&
                            createPortal(
                                <div
                                    ref={agentMenuRef}
                                    className="dr-menu p-2"
                                    role="dialog"
                                    aria-label={td("Select agent", { source: "en" })}
                                    style={{
                                        ...agentFloatStyle,
                                        minWidth: Math.max(
                                            agentBtnRef.current?.offsetWidth ??
                                                260,
                                            260,
                                        ),
                                        maxWidth: 420,
                                        overflowY: "auto",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <AgentPicker
                                        onPick={handleAgentPick}
                                        autoFocus
                                        searchPlaceholder={td("Search agents…", { source: "en" })}
                                        loadingLabel={td("Loading…", { source: "en" })}
                                        emptyLabel={td("No agents match", { source: "en" })}
                                    />
                                    {agentId != null && (
                                        <>
                                            <div
                                                className="dr-menu-sep"
                                                role="separator"
                                                style={{ margin: "8px 0" }}
                                            />
                                            <button
                                                type="button"
                                                className="dr-menu-item danger"
                                                onClick={() => {
                                                    setAgentId(null);
                                                    setAgentPickerOpen(false);
                                                }}
                                            >
                                                {td("Unassign", { source: "en" })}
                                            </button>
                                        </>
                                    )}
                                </div>,
                                document.body,
                            )}
                    </ModalField>

                    <ModalField label={td("Category", { source: "en" })}>
                        <MenuSelect
                            fullWidth
                            value={categoryId ?? ""}
                            placeholder={td("Select category", { source: "en" })}
                            options={toMenuOptions(
                                categories.map((cat) => ({
                                    id: cat.id,
                                    label: cat.category_name ?? cat.name ?? "",
                                })),
                                td("Select category", { source: "en" }),
                            )}
                            onChange={(value) =>
                                setCategoryId(parseMenuId(value))
                            }
                            disabled={saving}
                        />
                    </ModalField>

                    <ModalField label={td("Deal name", { source: "en" })}>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={td("Optional — defaults from property/package", { source: "en" })}
                        />
                    </ModalField>
                </>
            )}

            {step === 2 && (
                <>
                    <div className="mb-4">
                        <Switch
                            checked={addKickoffMeeting}
                            onChange={() =>
                                setAddKickoffMeeting((current) => !current)
                            }
                            disabled={saving}
                            label={td("Schedule a kickoff / consultation meeting", { source: "en" })}
                        />
                    </div>

                    {addKickoffMeeting ? (
                        <MeetingFormFields
                            form={meetingForm}
                            onChange={patchMeeting}
                            meetingTypes={meetingTypes}
                            disabled={saving}
                            mustIncludeOwner={
                                selectedAgent?.user?.id && selectedAgent.user.name
                                    ? { id: selectedAgent.user.id, name: selectedAgent.user.name }
                                    : null
                            }
                        />
                    ) : (
                        <p
                            className="mb-2 text-[13px]"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {td("You can create the deal now and schedule a meeting later.", { source: "en" })}
                        </p>
                    )}
                </>
            )}
        </Modal>
    );
}

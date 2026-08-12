import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";
import { message } from "antd";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    Badge,
    Button,
    Icon,
    MenuSelect,
    Modal,
    Switch,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign";
import type { MenuOption } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { getQualificationTemplateService } from "@/Services/QualificationTemplateService";
import { stripHtmlTags } from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import type {
    PublishedTemplate,
    Segment,
    TemplateTree,
} from "@/Types/qualification";
import {
    fetchScriptMapping,
    saveScriptMapping,
    type FieldMappingRow,
    type LeadFieldOption,
    type WriteMode,
} from "@/Features/Leads/QualificationMapping/mappingApi";
// dr-btn / dr-menu / .modal-panel live here — without this the Redesign
// primitives render completely unstyled on this page.
import "@/Components/Redesign/redesign.css";

interface Props extends PageProps {
    pageTitle: string;
    leadFields: LeadFieldOption[];
    writeModes: Array<{ value: WriteMode; label: string }>;
}

const NO_FIELD = "__none__";
const LEAVE_EMPTY = "__empty__";

/**
 * MenuSelect treats `width` as a max-width and stays inline-flex, so a bare
 * select shrinks to its label instead of filling its column. `fullWidth` makes
 * it fill but also switches on the 44px modal-input sizing — these bring it
 * back to the compact 32px control the table rows need.
 */
const SELECT_TRIGGER: CSSProperties = {
    minHeight: 32,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 500,
};

/** Rows are keyed by segment; the form only ever holds one script's mapping. */
type Draft = Record<string, FieldMappingRow>;

const emptyRow = (segmentKey: string): FieldMappingRow => ({
    segment_key: segmentKey,
    lead_field: null,
    write_mode: "fill_empty",
    option_map: {},
});

const QualificationMappingIndex = ({ leadFields, writeModes }: Props) => {
    const { td } = useTd();
    const templateService = useMemo(() => getQualificationTemplateService(), []);

    const [templates, setTemplates] = useState<PublishedTemplate[]>([]);
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [tree, setTree] = useState<TemplateTree | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [autoWrite, setAutoWrite] = useState(true);
    const [draft, setDraft] = useState<Draft>({});
    const [saved, setSaved] = useState<{ autoWrite: boolean; draft: Draft }>({
        autoWrite: true,
        draft: {},
    });
    const [optionsFor, setOptionsFor] = useState<Segment | null>(null);

    const template = templates.find((item) => item.id === templateId) ?? null;

    // Scripts live in OL, so the picker is populated client-side.
    useEffect(() => {
        let cancelled = false;
        void templateService
            .getPublishedTemplates()
            .then((response) => {
                if (cancelled) return;
                const list = response.data ?? [];
                setTemplates(list);
                setTemplateId((prev) => prev ?? list[0]?.id ?? null);
            })
            .catch(() => {
                if (!cancelled) message.error("Failed to load qualification scripts");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [templateService]);

    // Tree (the questions) and saved mapping load together — the table needs both.
    useEffect(() => {
        if (!templateId) return;
        let cancelled = false;
        setLoading(true);
        setTree(null);

        void Promise.all([
            templateService.getTemplateTree(templateId),
            fetchScriptMapping(templateId),
        ])
            .then(([treeResponse, mapping]) => {
                if (cancelled) return;
                setTree(treeResponse.data);
                const next: Draft = {};
                for (const row of mapping.mappings) {
                    next[row.segment_key] = row;
                }
                setDraft(next);
                setAutoWrite(mapping.auto_write);
                setSaved({ autoWrite: mapping.auto_write, draft: next });
            })
            .catch(() => {
                if (!cancelled) message.error("Failed to load the script mapping");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [templateId, templateService]);

    const questions = useMemo(
        () =>
            (tree?.segments ?? [])
                .filter((segment) => segment.type === "question")
                .sort((a, b) => a.sortOrder - b.sortOrder),
        [tree],
    );

    const fieldsByKey = useMemo(
        () => new Map(leadFields.map((field) => [field.value, field])),
        [leadFields],
    );

    const fieldOptions = useMemo<MenuOption[]>(
        () => [
            { value: NO_FIELD, label: td("Not mapped", { source: "en" }) },
            ...leadFields.map((field) => ({
                value: field.value,
                label: `${field.group} · ${field.label}`,
            })),
        ],
        [leadFields, td],
    );

    const rowFor = useCallback(
        (segmentKey: string) => draft[segmentKey] ?? emptyRow(segmentKey),
        [draft],
    );

    const patchRow = useCallback(
        (segmentKey: string, patch: Partial<FieldMappingRow>) => {
            setDraft((prev) => ({
                ...prev,
                [segmentKey]: {
                    ...(prev[segmentKey] ?? emptyRow(segmentKey)),
                    ...patch,
                },
            }));
        },
        [],
    );

    /** A mapped choice question with no option targets writes nothing. */
    const needsOptions = useCallback(
        (segment: Segment) => {
            const row = rowFor(segment.key);
            const field = row.lead_field ? fieldsByKey.get(row.lead_field) : null;
            if (!field || field.values.length === 0) return false;
            if (!segment.options?.length) return false;
            return Object.values(row.option_map).filter(Boolean).length === 0;
        },
        [fieldsByKey, rowFor],
    );

    const incompleteCount = questions.filter(needsOptions).length;

    const dirty =
        autoWrite !== saved.autoWrite ||
        JSON.stringify(draft) !== JSON.stringify(saved.draft);

    const handleSave = async () => {
        if (!templateId || saving) return;
        setSaving(true);
        try {
            const mappings = questions.map((segment) => rowFor(segment.key));
            await saveScriptMapping(templateId, {
                template_name: template?.name ?? null,
                auto_write: autoWrite,
                mappings,
            });
            const next: Draft = {};
            for (const row of mappings) {
                if (row.lead_field) next[row.segment_key] = row;
            }
            setDraft(next);
            setSaved({ autoWrite, draft: next });
            message.success(td("Mapping saved", { source: "en" }));
        } catch {
            message.error(td("Failed to save the mapping", { source: "en" }));
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        setDraft(saved.draft);
        setAutoWrite(saved.autoWrite);
    };

    return (
        <PageLayout
            title={td("Qualification script field mapping", { source: "en" })}
            breadcrumbs={[
                { name: td("Leads", { source: "en" }), url: route("lead-contact.index") },
                { name: td("Qualification script field mapping", { source: "en" }) },
            ]}
        >
            <div
                className="max-w-[1200px] mx-auto flex flex-col gap-4"
                style={{ fontFamily: "inherit" }}
            >
                <div className="flex items-start gap-3.5 flex-wrap">
                    <div className="flex-1 min-w-0">
                        <div
                            className="text-[12px]"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {td("Qualification scripts", { source: "en" })}
                            {template
                                ? ` · ${template.name} · v${template.version}`
                                : ""}
                        </div>
                        <h1
                            className="mt-1.5 mb-0 text-[19px] font-bold"
                            style={{ color: T.NAVY }}
                        >
                            {td("Qualification script field mapping", { source: "en" })}
                        </h1>
                        <p
                            className="mt-1.5 mb-0 text-[13px] leading-relaxed max-w-[640px]"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {td(
                                "What an agent captures on the call can write straight into the lead. Map each question to a field, then map its options to that field's values.",
                                { source: "en" },
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div style={{ width: 260 }}>
                            <MenuSelect
                                value={templateId}
                                options={templates.map((item) => ({
                                    value: item.id,
                                    label: item.name,
                                }))}
                                onChange={(value) => setTemplateId(String(value))}
                                placeholder={td("Select a script", {
                                    source: "en",
                                })}
                                fullWidth
                                triggerStyle={SELECT_TRIGGER}
                            />
                        </div>
                        <Button
                            size="sm"
                            disabled={!dirty || saving}
                            onClick={handleDiscard}
                        >
                            {td("Discard", { source: "en" })}
                        </Button>
                        <Button
                            size="sm"
                            variant="primary"
                            icon={<Icon name="check" size={13} />}
                            loading={saving}
                            disabled={!templateId || !dirty}
                            onClick={() => void handleSave()}
                        >
                            {td("Save mapping", { source: "en" })}
                        </Button>
                    </div>
                </div>

                <div
                    className="flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl flex-wrap"
                    style={{
                        background: T.SURFACE,
                        border: `1px solid ${T.BORDER}`,
                        padding: "14px 18px",
                    }}
                >
                    <Switch
                        checked={autoWrite}
                        onChange={() => setAutoWrite((prev) => !prev)}
                        aria-label={td(
                            "Write answers into the lead during the call",
                            { source: "en" },
                        )}
                    />
                    <div className="min-w-0">
                        <div
                            className="text-[14px] font-semibold"
                            style={{ color: T.TEXT }}
                        >
                            {td("Write answers into the lead during the call", {
                                source: "en",
                            })}
                        </div>
                        <div
                            className="text-[12px]"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {td(
                                "Off: answers stay on the call only and never touch lead fields.",
                                { source: "en" },
                            )}
                        </div>
                    </div>
                    <span className="flex-1" />
                    {incompleteCount > 0 ? (
                        <Badge variant="amber">
                            {incompleteCount}{" "}
                            {incompleteCount === 1
                                ? td("question needs options", { source: "en" })
                                : td("questions need options", { source: "en" })}
                        </Badge>
                    ) : null}
                </div>

                <div
                    className="rounded-xl"
                    style={{
                        background: T.SURFACE,
                        border: `1px solid ${T.BORDER}`,
                    }}
                >
                    <div
                        className="grid gap-4 px-4.5 py-2.5 text-[12px] font-bold uppercase tracking-wider rounded-t-xl"
                        style={{
                            gridTemplateColumns:
                                "minmax(0, 1fr) 210px 170px 210px",
                            background: T.SURFACE_2,
                            borderBottom: `1px solid ${T.BORDER}`,
                            color: T.TEXT_MUTED,
                            padding: "11px 18px",
                        }}
                    >
                        <span>{td("Script question", { source: "en" })}</span>
                        <span>{td("Lead field", { source: "en" })}</span>
                        <span>{td("On conflict", { source: "en" })}</span>
                        <span>{td("Options", { source: "en" })}</span>
                    </div>

                    {loading ? (
                        <p
                            className="m-0 px-[18px] py-5 text-[13px]"
                            style={{ color: T.TEXT_HINT }}
                        >
                            {td("Loading script…", { source: "en" })}
                        </p>
                    ) : questions.length === 0 ? (
                        <p
                            className="m-0 px-[18px] py-5 text-[13px]"
                            style={{ color: T.TEXT_HINT }}
                        >
                            {td("This script has no questions to map.", {
                                source: "en",
                            })}
                        </p>
                    ) : (
                        questions.map((segment) => {
                            const row = rowFor(segment.key);
                            const field = row.lead_field
                                ? fieldsByKey.get(row.lead_field)
                                : null;
                            const mappable = Boolean(
                                field?.values.length && segment.options?.length,
                            );
                            const mapped = countMappedOptions(
                                segment,
                                row.option_map,
                            );

                            return (
                                <div
                                    key={segment.key}
                                    className="grid gap-4 items-center"
                                    style={{
                                        gridTemplateColumns:
                                            "minmax(0, 1fr) 210px 170px 210px",
                                        padding: "13px 18px",
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                    }}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            {segment.category === "main" ||
                                            segment.isEntryQuestion ? (
                                                <Badge variant="navy">
                                                    {td("Main", { source: "en" })}
                                                </Badge>
                                            ) : null}
                                            <span
                                                className="text-[14px] font-semibold leading-snug"
                                                style={{ color: T.TEXT }}
                                            >
                                                {stripHtmlTags(segment.label) ||
                                                    segment.key}
                                            </span>
                                        </div>
                                        <div
                                            className="mt-1 text-[12px]"
                                            style={{ color: T.TEXT_HINT }}
                                        >
                                            {segment.answerType ?? "text"}
                                            {segment.options?.length
                                                ? ` · ${segment.options.length} ${td("options", { source: "en" })}`
                                                : ""}
                                        </div>
                                    </div>

                                    <MenuSelect
                                        size="sm"
                                        value={row.lead_field ?? NO_FIELD}
                                        options={fieldOptions}
                                        onChange={(value) => {
                                            const next =
                                                value === NO_FIELD
                                                    ? null
                                                    : String(value);
                                            patchRow(segment.key, {
                                                lead_field: next,
                                                // Targets differ in their value sets — a
                                                // stale option map would write garbage.
                                                option_map: {},
                                            });
                                        }}
                                        fullWidth
                                        triggerStyle={SELECT_TRIGGER}
                                    />

                                    <MenuSelect
                                        size="sm"
                                        value={row.write_mode}
                                        options={writeModes}
                                        onChange={(value) =>
                                            patchRow(segment.key, {
                                                write_mode: value as WriteMode,
                                            })
                                        }
                                        disabled={!row.lead_field}
                                        fullWidth
                                        triggerStyle={SELECT_TRIGGER}
                                    />

                                    <div className="flex items-center gap-2.5">
                                        {needsOptions(segment) ? (
                                            <Icon
                                                name="info"
                                                size={14}
                                                color={T.AMBER_TEXT}
                                            />
                                        ) : null}
                                        <span
                                            className="flex-1 min-w-0 text-[12px] leading-snug"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            {!row.lead_field
                                                ? "—"
                                                : mappable
                                                  ? `${mapped}/${segment.options?.length ?? 0} ${td("mapped", { source: "en" })}`
                                                  : td("Answer written as text", {
                                                        source: "en",
                                                    })}
                                        </span>
                                        {mappable ? (
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    setOptionsFor(segment)
                                                }
                                            >
                                                {td("Map", { source: "en" })}
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    <p
                        className="m-0 text-[12px]"
                        style={{ padding: "12px 18px", color: T.TEXT_HINT }}
                    >
                        {td(
                            "Unmapped questions still show on the call — they just never touch the lead.",
                            { source: "en" },
                        )}
                    </p>
                </div>
            </div>

            {optionsFor ? (
                <OptionMapModal
                    segment={optionsFor}
                    field={
                        fieldsByKey.get(rowFor(optionsFor.key).lead_field ?? "") ??
                        null
                    }
                    optionMap={rowFor(optionsFor.key).option_map}
                    onSave={(optionMap) => {
                        patchRow(optionsFor.key, { option_map: optionMap });
                        setOptionsFor(null);
                    }}
                    onClose={() => setOptionsFor(null)}
                />
            ) : null}
        </PageLayout>
    );
};

/**
 * An answer stores either the option's `key` or its `id` (see
 * mapOptionIdsToStoredValues / matchOptionByStoredValue), so the saved map
 * carries both — the server-side writer resolves by plain lookup.
 */
/** Distinct script options with a target, not raw map entries (see expandOptionMap). */
function countMappedOptions(
    segment: Segment,
    optionMap: Record<string, string>,
): number {
    return (segment.options ?? []).filter(
        (option) => optionMap[option.key] || optionMap[option.id],
    ).length;
}

function expandOptionMap(
    segment: Segment,
    byKey: Record<string, string>,
): Record<string, string> {
    const expanded: Record<string, string> = {};
    for (const option of segment.options ?? []) {
        const target = byKey[option.key];
        if (!target) continue;
        expanded[option.key] = target;
        if (option.id && option.id !== option.key) expanded[option.id] = target;
    }
    return expanded;
}

function OptionMapModal({
    segment,
    field,
    optionMap,
    onSave,
    onClose,
}: {
    segment: Segment;
    field: LeadFieldOption | null;
    optionMap: Record<string, string>;
    onSave: (optionMap: Record<string, string>) => void;
    onClose: () => void;
}) {
    const { td } = useTd();
    // Collapse the stored key+id map back to one entry per option.
    const [local, setLocal] = useState<Record<string, string>>(() => {
        const byKey: Record<string, string> = {};
        for (const option of segment.options ?? []) {
            const target = optionMap[option.key] ?? optionMap[option.id];
            if (target) byKey[option.key] = target;
        }
        return byKey;
    });

    const valueOptions = useMemo<MenuOption[]>(
        () => [
            { value: LEAVE_EMPTY, label: td("Leave empty", { source: "en" }) },
            ...(field?.values ?? []).map((value) => ({
                value: value.value,
                label: value.label,
            })),
        ],
        [field, td],
    );

    const mapped = Object.values(local).filter(Boolean).length;
    const total = segment.options?.length ?? 0;

    return (
        <Modal
            open
            title={stripHtmlTags(segment.label) || segment.key}
            subtitle={
                field
                    ? `${td("Answers write into", { source: "en" })} ${field.label}`
                    : undefined
            }
            headerTone="sunken"
            onClose={onClose}
            maxWidth={720}
            footer={
                <div className="flex items-center gap-2.5 w-full">
                    <span
                        className="text-[12px]"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {mapped}/{total} {td("options mapped", { source: "en" })}
                    </span>
                    <span className="flex-1" />
                    <Button onClick={onClose}>
                        {td("Cancel", { source: "en" })}
                    </Button>
                    <Button
                        variant="primary"
                        icon={<Icon name="check" size={13} />}
                        onClick={() => onSave(expandOptionMap(segment, local))}
                    >
                        {td("Save option mapping", { source: "en" })}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <div
                    className="grid gap-4 text-[12px] font-bold uppercase tracking-wider"
                    style={{
                        gridTemplateColumns: "minmax(0, 1fr) 250px",
                        color: T.TEXT_MUTED,
                    }}
                >
                    <span>{td("Script option", { source: "en" })}</span>
                    <span>{field?.label ?? td("Lead field", { source: "en" })}</span>
                </div>

                {(segment.options ?? []).map((option) => (
                    <div
                        key={option.key}
                        className="grid gap-4 items-center pb-3"
                        style={{
                            gridTemplateColumns: "minmax(0, 1fr) 250px",
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <span
                            className="text-[14px] leading-relaxed"
                            style={{ color: T.TEXT }}
                        >
                            {stripHtmlTags(option.label)}
                        </span>
                        <MenuSelect
                            size="sm"
                            value={local[option.key] || LEAVE_EMPTY}
                            options={valueOptions}
                            onChange={(value) =>
                                setLocal((prev) => {
                                    const next = { ...prev };
                                    if (value === LEAVE_EMPTY) {
                                        delete next[option.key];
                                    } else {
                                        next[option.key] = String(value);
                                    }
                                    return next;
                                })
                            }
                            fullWidth
                            triggerStyle={SELECT_TRIGGER}
                        />
                    </div>
                ))}

                <p
                    className="m-0 text-[12px] leading-relaxed"
                    style={{ color: T.TEXT_HINT }}
                >
                    {td(
                        'An option left on "Leave empty" is captured on the call but written nowhere.',
                        { source: "en" },
                    )}
                </p>
            </div>
        </Modal>
    );
}

QualificationMappingIndex.layout = (page: ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default QualificationMappingIndex;

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { PlusOutlined } from "@ant-design/icons";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { EmailTemplate, VariableMapping } from "./types";
import { conditionFieldGroups, mergeTagGroups } from "./config/builderFields";
import { buildPreviewHtml } from "./adapters/emailPreview";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";
import useEmailTemplateMutations from "./hooks/useEmailTemplateMutations";
import TagPickerButton from "./components/TagPickerButton";

interface TemplateEditorProps {
    template?: EmailTemplate;
    onBack: () => void;
}

interface PlunkTemplate {
    id: string;
    name?: string;
}

function useDebounced<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const handle = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(handle);
    }, [value, delayMs]);
    return debounced;
}

export default function TemplateEditor({ template, onBack }: TemplateEditorProps) {
    const { t } = useTranslation();
    const { catalog } = useAutomationWorkspace();
    const { createTemplate, updateTemplate, savingId } = useEmailTemplateMutations();

    const [name, setName] = useState(template?.name ?? t("app.automation.untitledTemplate"));
    const [mode, setMode] = useState<"custom" | "plunk_body">(template?.mode ?? "custom");
    const [subject, setSubject] = useState(template?.subject ?? "");
    const [preheader, setPreheader] = useState(template?.preheader ?? "");
    const [body, setBody] = useState(template?.body ?? "");
    const [plunkTemplateId, setPlunkTemplateId] = useState(template?.plunk_template_id ?? "");
    const [plunkTemplates, setPlunkTemplates] = useState<PlunkTemplate[]>([]);
    const [mappings, setMappings] = useState<VariableMapping[]>(template?.variable_mappings ?? []);
    const [frameHeight, setFrameHeight] = useState(480);

    const isSaving = savingId === (template?.id ?? "new");
    const fieldGroups = useMemo(() => (catalog ? conditionFieldGroups("deal", catalog) : []), [catalog]);
    const mergeGroups = useMemo(() => (catalog ? mergeTagGroups("deal", catalog) : []), [catalog]);
    const subjectRef = useRef<HTMLInputElement | null>(null);
    const bodyRef = useRef<HTMLTextAreaElement | null>(null);
    const frameRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        if (mode !== "plunk_body") return;
        axios
            .get(route("email-templates.plunk-templates"), { headers: { Accept: "application/json" } })
            .then((res) => setPlunkTemplates(res.data?.templates ?? []))
            .catch(() => setPlunkTemplates([]));
    }, [mode]);

    // Rendered fully client-side (no network round-trip) so the preview is
    // exact-fidelity and instant, matching Brevo/Plunk/Resend's own template
    // editors — see adapters/emailPreview.ts. A short debounce just smooths
    // out the iframe's full-document reload on rapid typing; it isn't
    // covering network latency anymore.
    const debouncedSubject = useDebounced(subject, 150);
    const debouncedPreheader = useDebounced(preheader, 150);
    const debouncedBody = useDebounced(body, 150);

    const previewHtml = useMemo(() => {
        if (!debouncedBody.trim()) return "";
        try {
            return buildPreviewHtml({ subject: debouncedSubject, preheader: debouncedPreheader, body: debouncedBody, mode });
        } catch {
            return "";
        }
    }, [debouncedSubject, debouncedPreheader, debouncedBody, mode]);

    function handleFrameLoad() {
        try {
            const doc = frameRef.current?.contentDocument;
            if (!doc) return;
            const height = Math.max(
                doc.documentElement?.scrollHeight ?? 0,
                doc.body?.scrollHeight ?? 0,
            );
            setFrameHeight(Math.min(Math.max(480, height + 24), 1100));
        } catch {
            setFrameHeight(640);
        }
    }

    function updateMapping(index: number, patch: Partial<VariableMapping>) {
        setMappings((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
    }

    function removeMapping(index: number) {
        setMappings((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSave() {
        const payload = {
            name,
            mode,
            subject,
            preheader: preheader || null,
            body,
            plunk_template_id: mode === "plunk_body" ? plunkTemplateId || null : null,
            variable_mappings: mappings.filter((m) => m.variable.trim()),
        };

        const saved = template ? await updateTemplate(template.id, payload) : await createTemplate(payload);
        if (saved) onBack();
    }

    return (
        <div>
            <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 border-0 bg-transparent cursor-pointer p-0 mb-3"
                style={{ fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}
            >
                <Icon name="chevron-left" size={15} />
                {t("app.automation.backToTemplates")}
            </button>

            <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
                <div>
                    <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                        {template ? t("app.automation.editTemplate") : t("app.automation.newTemplate")}
                    </h1>
                    <p className="mt-1 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {t("app.automation.editorSubtitle")}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onBack}>
                        {t("app.cancel")}
                    </Button>
                    <Button variant="primary" loading={isSaving} onClick={handleSave} disabled={!name.trim() || !subject.trim()}>
                        {t("app.automation.saveTemplate")}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 440px" }}>
                {/* editor */}
                <div className="rounded-[10px] border bg-white p-5" style={{ borderColor: T.BORDER }}>
                    <div className="grid grid-cols-2 gap-3.5 mb-4">
                        <div>
                            <label className="dr-label block mb-1.5">{t("app.automation.templateName")}</label>
                            <input value={name} onChange={(e) => setName(e.target.value)} className="dr-input w-full" />
                        </div>
                        <div>
                            <label className="dr-label block mb-1.5">{t("app.automation.mode")}</label>
                            <SearchableSelect
                                value={mode}
                                onChange={(value) => setMode(value as "custom" | "plunk_body")}
                                options={Object.entries(catalog?.templateModes ?? {}).map(([key, label]) => ({ value: key, label }))}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="dr-label">{t("app.automation.subjectLine")}</label>
                            <TagPickerButton groups={mergeGroups} targetRef={subjectRef} value={subject} onChange={setSubject} />
                        </div>
                        <input ref={subjectRef} value={subject} onChange={(e) => setSubject(e.target.value)} className="dr-input w-full" />
                    </div>

                    <div className="mb-4">
                        <label className="dr-label block mb-1.5">{t("app.automation.preheader")}</label>
                        <input value={preheader} onChange={(e) => setPreheader(e.target.value)} className="dr-input w-full" />
                    </div>

                    {mode === "plunk_body" && (
                        <div className="mb-4">
                            <label className="dr-label block mb-1.5">{t("app.automation.plunkTemplateId")}</label>
                            <div className="flex gap-2">
                                <input
                                    value={plunkTemplateId}
                                    onChange={(e) => setPlunkTemplateId(e.target.value)}
                                    className="dr-input flex-1"
                                />
                                {plunkTemplates.length > 0 && (
                                    <SearchableSelect
                                        value={undefined}
                                        onChange={(value) => value && setPlunkTemplateId(String(value))}
                                        options={plunkTemplates.map((pt) => ({ value: pt.id, label: pt.name ?? pt.id }))}
                                        placeholder={t("app.automation.loadFromPlunk")}
                                        style={{ width: 200 }}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-1.5">
                        <label className="dr-label">{t("app.automation.body")}</label>
                        <TagPickerButton groups={mergeGroups} targetRef={bodyRef} value={body} onChange={setBody} />
                    </div>
                    <p className="mt-0 mb-1.5" style={{ fontSize: 11, color: T.TEXT_HINT, lineHeight: 1.5 }}>
                        {t("app.automation.bodyHint")}
                    </p>
                    <textarea
                        ref={bodyRef}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="dr-input w-full"
                        style={{ minHeight: 220, fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
                    />

                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="dr-label">{t("app.automation.mergeTags")}</label>
                            <button
                                type="button"
                                onClick={() => setMappings((prev) => [...prev, { variable: "", type: "field" }])}
                                className="inline-flex items-center gap-1 cursor-pointer border-0 bg-transparent"
                                style={{ fontSize: 12, fontWeight: 600, color: T.BLUE }}
                            >
                                <PlusOutlined /> {t("app.automation.addMapping")}
                            </button>
                        </div>
                        {mappings.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 mb-2 flex-wrap">
                                <input
                                    value={m.variable}
                                    onChange={(e) => updateMapping(i, { variable: e.target.value })}
                                    placeholder={t("app.automation.variableName")}
                                    className="dr-input"
                                    style={{ width: 140, fontFamily: "ui-monospace, monospace" }}
                                />
                                <SearchableSelect
                                    value={m.type}
                                    onChange={(value) => updateMapping(i, { type: value as VariableMapping["type"] })}
                                    options={[
                                        { value: "field", label: t("app.automation.field") },
                                        { value: "cta_url", label: t("app.automation.ctaUrl") },
                                    ]}
                                    style={{ width: 130 }}
                                />
                                {m.type === "field" ? (
                                    <SearchableSelect
                                        value={m.field || undefined}
                                        onChange={(value) => updateMapping(i, { field: value ?? "" })}
                                        options={fieldGroups}
                                        placeholder={t("app.automation.selectField")}
                                        popupMatchSelectWidth={280}
                                        style={{ flex: "1 1 160px" }}
                                    />
                                ) : (
                                    <>
                                        <SearchableSelect
                                            value={m.cta_target ?? "record"}
                                            onChange={(value) => updateMapping(i, { cta_target: value })}
                                            options={Object.entries(catalog?.ctaTargets ?? {}).map(([key, label]) => ({ value: key, label }))}
                                            style={{ width: 150 }}
                                        />
                                        {m.cta_target === "custom" && (
                                            <input
                                                value={m.cta_custom_url ?? ""}
                                                onChange={(e) => updateMapping(i, { cta_custom_url: e.target.value })}
                                                placeholder="https://…"
                                                className="dr-input"
                                                style={{ flex: "1 1 160px" }}
                                            />
                                        )}
                                    </>
                                )}
                                <button
                                    type="button"
                                    aria-label={t("app.remove")}
                                    onClick={() => removeMapping(i)}
                                    className="border-0 bg-transparent cursor-pointer flex"
                                    style={{ color: T.TEXT_HINT }}
                                >
                                    <Icon name="x" size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* preview */}
                <div className="sticky top-6">
                    <div className="mb-2.5 flex items-center justify-between">
                        <span className="dr-label">{t("app.automation.preview")}</span>
                    </div>
                    <div className="rounded-[10px] border overflow-hidden bg-white" style={{ borderColor: T.BORDER }}>
                        <iframe
                            ref={frameRef}
                            title={t("app.automation.preview")}
                            onLoad={handleFrameLoad}
                            srcDoc={
                                previewHtml ||
                                `<p style="font-family:sans-serif;color:#9aa3b2;padding:16px">Add body content to see the live preview.</p>`
                            }
                            style={{ width: "100%", height: frameHeight, border: "none", transition: "height 120ms ease" }}
                            sandbox=""
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

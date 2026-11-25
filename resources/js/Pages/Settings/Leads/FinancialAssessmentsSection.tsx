import { useState } from "react";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Switch from "@/Components/Redesign/primitives/Switch";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useFinancialAssessmentSettings from "./hooks/useFinancialAssessmentSettings";
import type {
    FinancialAssessmentSettings,
    FinancialCertainty,
    FinancialCryptoAssetRow,
    FinancialFrequency,
    FinancialKindRole,
    FinancialKindRow,
    FinancialTypeRow,
} from "./types";

const LABEL_STYLE = { display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED } as const;
const CARD_STYLE = { background: T.WHITE, border: `1px solid ${T.BORDER}`, borderRadius: 10, overflow: "hidden" } as const;
const TYPE_GRID =
    "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_auto] items-center gap-x-3 px-3.5 py-2.5 border-b last:border-b-0";
const ASSET_GRID =
    "grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto_auto] items-center gap-x-3 px-3.5 py-2.5 border-b last:border-b-0";

type TypeForm = { kindId: number; editing: FinancialTypeRow | null };
type AssetForm = { editing: FinancialCryptoAssetRow | null };

/**
 * Settings tab for lead financial assessments: the kinds and types of line,
 * the crypto assets rates are fetched for, and the company defaults. The
 * server data arrives deferred and is then owned by useFinancialAssessmentSettings.
 */
export default function FinancialAssessmentsSection({ initial }: { initial: FinancialAssessmentSettings }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const state = useFinancialAssessmentSettings(initial);
    const { settings, saving } = state;

    const [addingKind, setAddingKind] = useState(false);
    const [kindName, setKindName] = useState("");
    const [kindRole, setKindRole] = useState<FinancialKindRole>("funding");
    const [renaming, setRenaming] = useState<FinancialKindRow | null>(null);
    const [renameValue, setRenameValue] = useState("");

    const [typeForm, setTypeForm] = useState<TypeForm | null>(null);
    const [typeName, setTypeName] = useState("");
    const [typeFrequency, setTypeFrequency] = useState<FinancialFrequency | "">("");
    const [typeCertainty, setTypeCertainty] = useState<FinancialCertainty | "">("");

    const [assetForm, setAssetForm] = useState<AssetForm | null>(null);
    const [assetTicker, setAssetTicker] = useState("");
    const [assetProviderId, setAssetProviderId] = useState("");
    const [assetName, setAssetName] = useState("");

    const [currency, setCurrency] = useState(settings.defaults.reporting_currency);
    const [days, setDays] = useState(String(settings.defaults.refresh_after_days));

    const roleLabel = (role: FinancialKindRole) => t(`pages.lead_settings.financial.roles.${role}`);
    const roleExplain = (role: FinancialKindRole) => t(`pages.lead_settings.financial.role_explain.${role}`);
    const frequencyLabel = (value: FinancialFrequency | null) => (value ? t(`pages.lead_settings.financial.frequencies.${value}`) : "—");
    const certaintyLabel = (value: FinancialCertainty | null) => (value ? t(`pages.lead_settings.financial.certainties.${value}`) : "—");

    const frequencyOptions = [
        { value: "", label: t("pages.lead_settings.financial.no_default") },
        ...settings.options.frequencies.map((value) => ({ value, label: frequencyLabel(value) })),
    ];
    const certaintyOptions = [
        { value: "", label: t("pages.lead_settings.financial.no_default") },
        ...settings.options.certainties.map((value) => ({ value, label: certaintyLabel(value) })),
    ];

    const openTypeForm = (kindId: number, editing: FinancialTypeRow | null) => {
        setTypeForm({ kindId, editing });
        setTypeName(editing?.label ?? "");
        setTypeFrequency(editing?.default_frequency ?? "");
        setTypeCertainty(editing?.default_certainty ?? "");
    };

    const openAssetForm = (editing: FinancialCryptoAssetRow | null) => {
        setAssetForm({ editing });
        setAssetTicker(editing?.ticker ?? "");
        setAssetProviderId(editing?.provider_id ?? "");
        setAssetName(editing?.name ?? "");
    };

    const submitKind = async () => {
        if (!kindName.trim()) return;
        if (await state.createKind(kindName, kindRole)) {
            setAddingKind(false);
            setKindName("");
        }
    };

    const submitRename = async () => {
        if (!renaming || !renameValue.trim()) return;
        if (await state.updateKind(renaming.id, { label: renameValue })) setRenaming(null);
    };

    const submitType = async () => {
        if (!typeForm || !typeName.trim()) return;
        const frequency = typeFrequency === "" ? null : typeFrequency;
        const certainty = typeCertainty === "" ? null : typeCertainty;
        const ok = typeForm.editing
            ? await state.updateType(typeForm.editing.id, { label: typeName, default_frequency: frequency, default_certainty: certainty })
            : await state.createType(typeForm.kindId, typeName, frequency, certainty);
        if (ok) setTypeForm(null);
    };

    const submitAsset = async () => {
        if (!assetForm || !assetProviderId.trim() || !assetName.trim()) return;
        const ok = assetForm.editing
            ? await state.updateAsset(assetForm.editing.id, { provider_id: assetProviderId, name: assetName })
            : await state.createAsset(assetTicker, assetProviderId, assetName);
        if (ok) setAssetForm(null);
    };

    const defaultsDirty =
        currency !== settings.defaults.reporting_currency || days !== String(settings.defaults.refresh_after_days);

    const test = state.testResult;
    const testMessage = !test
        ? null
        : test.ok
          ? t("pages.lead_settings.financial.crypto.test_ok", {
                ticker: test.ticker ?? "",
                rate: test.rate?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "",
                currency: test.currency,
                source: test.source ?? "",
            })
          : t(`pages.lead_settings.financial.crypto.test_${test.reason ?? "no_rate"}`, { ticker: test.ticker ?? "" });

    return (
        <div className="flex flex-col" style={{ gap: 20 }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <p style={{ margin: 0, flex: "1 1 280px", fontSize: REDESIGN_TYPE.BODY, color: T.TEXT_MUTED, lineHeight: 1.45 }}>
                    {t("pages.lead_settings.financial.intro")}
                </p>
                <Button variant="primary" size="sm" icon={<Icon name="plus" size={14} />} onClick={() => setAddingKind(true)} disabled={addingKind}>
                    {t("pages.lead_settings.financial.add_kind")}
                </Button>
            </div>

            {addingKind && (
                <section
                    aria-labelledby="fa-new-kind"
                    style={{ background: T.BLUE_WASH, border: `1px solid ${T.BLUE_MID}`, borderRadius: 10, padding: "14px 16px" }}
                >
                    <h3 id="fa-new-kind" style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: T.TEXT }}>
                        {t("pages.lead_settings.financial.new_kind")}
                    </h3>
                    <div className="flex flex-wrap items-end gap-3">
                        <div style={{ flex: "1 1 200px" }}>
                            <label htmlFor="fa-kind-name" style={LABEL_STYLE}>
                                {t("pages.lead_settings.financial.kind_name")}
                            </label>
                            <input
                                id="fa-kind-name"
                                className="dr-input"
                                value={kindName}
                                maxLength={120}
                                onChange={(event) => setKindName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") void submitKind();
                                }}
                                autoFocus
                            />
                        </div>
                        <div style={{ flex: "1 1 260px" }}>
                            <span style={LABEL_STYLE}>{t("pages.lead_settings.financial.kind_role")}</span>
                            <MenuSelect
                                value={kindRole}
                                fullWidth
                                onChange={(value) => setKindRole(value as FinancialKindRole)}
                                options={settings.options.roles.map((role) => ({
                                    value: role,
                                    label: `${roleLabel(role)}: ${roleExplain(role)}`,
                                }))}
                            />
                        </div>
                        <Button variant="primary" onClick={() => void submitKind()} loading={saving === "kind"} disabled={!kindName.trim()}>
                            {t("pages.lead_settings.financial.create_kind")}
                        </Button>
                        <Button variant="ghost" onClick={() => setAddingKind(false)} disabled={saving === "kind"}>
                            {t("app.cancel")}
                        </Button>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: T.TEXT_MUTED }}>{t("pages.lead_settings.financial.role_locked")}</p>
                </section>
            )}

            {settings.kinds.map((kind) => (
                <section key={kind.id} style={{ ...CARD_STYLE, opacity: kind.is_active ? 1 : 0.7 }}>
                    <header
                        className="flex flex-wrap items-center gap-x-3 gap-y-2"
                        style={{ padding: "12px 16px", background: T.SURFACE_SUBTLE, borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                    >
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.TEXT }}>{td(kind.label, { source: "en" })}</h3>
                        <Badge variant="navy">{roleLabel(kind.role)}</Badge>
                        {!kind.is_active && <Badge variant="gray">{t("pages.lead_settings.financial.inactive")}</Badge>}
                        <span style={{ fontSize: 13, color: T.TEXT_MUTED }}>{roleExplain(kind.role)}</span>
                        <span className="ml-auto flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Icon name="edit" size={14} />}
                                aria-label={t("pages.lead_settings.financial.rename_kind")}
                                onClick={() => {
                                    setRenaming(kind);
                                    setRenameValue(kind.label);
                                }}
                            />
                            <Switch
                                checked={kind.is_active}
                                label={t("pages.lead_settings.financial.col_active")}
                                onChange={() => void state.updateKind(kind.id, { is_active: !kind.is_active })}
                                disabled={saving === "kind"}
                            />
                        </span>
                    </header>

                    <div className="overflow-x-auto">
                        <div style={{ minWidth: 640 }}>
                            <div
                                className={TYPE_GRID}
                                style={{ borderColor: T.BORDER_SOFT, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}
                            >
                                <span>{t("pages.lead_settings.financial.col_type")}</span>
                                <span>{t("pages.lead_settings.financial.col_key")}</span>
                                <span>{t("pages.lead_settings.financial.col_frequency")}</span>
                                <span>{t("pages.lead_settings.financial.col_certainty")}</span>
                                <span>{t("pages.lead_settings.financial.col_used")}</span>
                                <span>{t("pages.lead_settings.financial.col_active")}</span>
                            </div>
                            {kind.types.map((type) => (
                                <div
                                    key={type.id}
                                    className={TYPE_GRID}
                                    style={{ borderColor: T.BORDER_SOFT, background: type.is_active ? T.SURFACE : T.SURFACE_SUBTLE, fontSize: 14 }}
                                >
                                    <span className="truncate font-medium" style={{ color: T.TEXT }} title={type.label}>
                                        {td(type.label, { source: "en" })}
                                    </span>
                                    <code style={{ fontSize: 12.5, color: T.GRAY_DARKER }}>{type.key}</code>
                                    <span>{frequencyLabel(type.default_frequency)}</span>
                                    <span>{certaintyLabel(type.default_certainty)}</span>
                                    <span style={{ color: T.TEXT_MUTED }}>{t("pages.lead_settings.financial.lines_count", { count: type.line_count })}</span>
                                    <span className="flex items-center gap-2">
                                        <Switch
                                            checked={type.is_active}
                                            label={t("pages.lead_settings.financial.col_active")}
                                            onChange={() => void state.updateType(type.id, { is_active: !type.is_active })}
                                            disabled={saving === "type"}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={<Icon name="edit" size={14} />}
                                            aria-label={t("app.edit")}
                                            onClick={() => openTypeForm(kind.id, type)}
                                        />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <footer style={{ padding: "10px 16px", borderTop: `1px solid ${T.BORDER_SOFT}` }}>
                        <Button variant="ghost" size="sm" icon={<Icon name="plus" size={14} />} onClick={() => openTypeForm(kind.id, null)}>
                            {t("pages.lead_settings.financial.add_type")}
                        </Button>
                    </footer>
                </section>
            ))}

            <section style={CARD_STYLE}>
                <header
                    className="flex flex-wrap items-center gap-x-3 gap-y-2"
                    style={{ padding: "12px 16px", background: T.SURFACE_SUBTLE, borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                >
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.TEXT }}>{t("pages.lead_settings.financial.crypto.title")}</h3>
                    <Badge variant={settings.provider.configured ? "green" : "amber"}>
                        {settings.provider.configured
                            ? t("pages.lead_settings.financial.crypto.provider_ready", { name: settings.provider.name ?? "" })
                            : t("pages.lead_settings.financial.crypto.provider_missing", { name: settings.provider.name ?? "" })}
                    </Badge>
                </header>
                <div className="overflow-x-auto">
                    <div style={{ minWidth: 560 }}>
                        <div className={ASSET_GRID} style={{ borderColor: T.BORDER_SOFT, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>
                            <span>{t("pages.lead_settings.financial.crypto.ticker")}</span>
                            <span>{t("pages.lead_settings.financial.crypto.provider_id")}</span>
                            <span>{t("pages.lead_settings.financial.crypto.name")}</span>
                            <span>{t("pages.lead_settings.financial.col_active")}</span>
                            <span />
                        </div>
                        {settings.crypto_assets.map((asset) => (
                            <div key={asset.id} className={ASSET_GRID} style={{ borderColor: T.BORDER_SOFT, background: asset.is_active ? T.SURFACE : T.SURFACE_SUBTLE, fontSize: 14 }}>
                                <strong style={{ fontWeight: 600 }}>{asset.ticker}</strong>
                                <code style={{ fontSize: 12.5, color: T.GRAY_DARKER }}>{asset.provider_id}</code>
                                <span className="truncate">{asset.name}</span>
                                <Switch
                                    checked={asset.is_active}
                                    label={t("pages.lead_settings.financial.col_active")}
                                    onChange={() => void state.updateAsset(asset.id, { is_active: !asset.is_active })}
                                    disabled={saving === "asset"}
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<Icon name="edit" size={14} />}
                                    aria-label={t("app.edit")}
                                    onClick={() => openAssetForm(asset)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                <footer className="flex flex-wrap items-center gap-3" style={{ padding: "10px 16px", borderTop: `1px solid ${T.BORDER_SOFT}` }}>
                    <Button variant="ghost" size="sm" icon={<Icon name="plus" size={14} />} onClick={() => openAssetForm(null)}>
                        {t("pages.lead_settings.financial.crypto.add_asset")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void state.testRates()} loading={saving === "test"}>
                        {t("pages.lead_settings.financial.crypto.test")}
                    </Button>
                    {testMessage && (
                        <span role="status" style={{ fontSize: 13, color: test?.ok ? T.GREEN : T.AMBER_TEXT }}>
                            {testMessage}
                        </span>
                    )}
                </footer>
            </section>

            <section style={{ ...CARD_STYLE, padding: "16px 18px" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: T.TEXT }}>{t("pages.lead_settings.financial.defaults.title")}</h3>
                <div className="flex flex-wrap items-end gap-4">
                    <div style={{ flex: "1 1 200px" }}>
                        <span style={LABEL_STYLE}>{t("pages.lead_settings.financial.defaults.reporting_currency")}</span>
                        <MenuSelect
                            value={currency}
                            fullWidth
                            onChange={(value) => setCurrency(String(value))}
                            options={settings.defaults.currencies.map((code) => ({ value: code, label: code }))}
                        />
                    </div>
                    <div style={{ flex: "1 1 200px" }}>
                        <label htmlFor="fa-refresh-days" style={LABEL_STYLE}>
                            {t("pages.lead_settings.financial.defaults.refresh_after")}
                        </label>
                        <input
                            id="fa-refresh-days"
                            className="dr-input"
                            inputMode="numeric"
                            value={days}
                            onChange={(event) => setDays(event.target.value.replace(/[^0-9]/g, ""))}
                        />
                    </div>
                    <Button
                        variant="primary"
                        loading={saving === "defaults"}
                        disabled={!defaultsDirty || days === ""}
                        onClick={() => void state.saveDefaults(currency, Number(days))}
                    >
                        {t("pages.lead_settings.financial.defaults.save")}
                    </Button>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: T.TEXT_MUTED }}>{t("pages.lead_settings.financial.defaults.help")}</p>
            </section>

            <Modal
                open={renaming !== null}
                title={t("pages.lead_settings.financial.rename_kind")}
                onClose={() => setRenaming(null)}
                dirty={renaming !== null && renameValue.trim() !== renaming.label}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setRenaming(null)} disabled={saving === "kind"}>
                            {t("app.cancel")}
                        </Button>
                        <Button variant="primary" onClick={() => void submitRename()} loading={saving === "kind"} disabled={!renameValue.trim()}>
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <label htmlFor="fa-rename" style={LABEL_STYLE}>
                    {t("pages.lead_settings.financial.kind_name")}
                </label>
                <input
                    id="fa-rename"
                    className="dr-input"
                    value={renameValue}
                    maxLength={120}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") void submitRename();
                    }}
                    autoFocus
                />
            </Modal>

            <Modal
                open={typeForm !== null}
                title={typeForm?.editing ? t("pages.lead_settings.financial.edit_type") : t("pages.lead_settings.financial.add_type")}
                onClose={() => setTypeForm(null)}
                dirty={typeName.trim().length > 0}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setTypeForm(null)} disabled={saving === "type"}>
                            {t("app.cancel")}
                        </Button>
                        <Button variant="primary" onClick={() => void submitType()} loading={saving === "type"} disabled={!typeName.trim()}>
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col" style={{ gap: 14 }}>
                    <div>
                        <label htmlFor="fa-type-name" style={LABEL_STYLE}>
                            {t("pages.lead_settings.financial.type_name")}
                        </label>
                        <input
                            id="fa-type-name"
                            className="dr-input"
                            value={typeName}
                            maxLength={120}
                            onChange={(event) => setTypeName(event.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <span style={LABEL_STYLE}>{t("pages.lead_settings.financial.col_frequency")}</span>
                        <MenuSelect value={typeFrequency} fullWidth options={frequencyOptions} onChange={(value) => setTypeFrequency(value as FinancialFrequency | "")} />
                    </div>
                    <div>
                        <span style={LABEL_STYLE}>{t("pages.lead_settings.financial.col_certainty")}</span>
                        <MenuSelect value={typeCertainty} fullWidth options={certaintyOptions} onChange={(value) => setTypeCertainty(value as FinancialCertainty | "")} />
                    </div>
                    {typeForm?.editing && <p style={{ margin: 0, fontSize: 12, color: T.TEXT_MUTED }}>{t("pages.lead_settings.financial.key_fixed", { key: typeForm.editing.key })}</p>}
                </div>
            </Modal>

            <Modal
                open={assetForm !== null}
                title={assetForm?.editing ? t("pages.lead_settings.financial.crypto.edit_asset") : t("pages.lead_settings.financial.crypto.add_asset")}
                onClose={() => setAssetForm(null)}
                dirty={assetProviderId.trim().length > 0 || assetName.trim().length > 0}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setAssetForm(null)} disabled={saving === "asset"}>
                            {t("app.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => void submitAsset()}
                            loading={saving === "asset"}
                            disabled={!assetProviderId.trim() || !assetName.trim() || (!assetForm?.editing && !assetTicker.trim())}
                        >
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col" style={{ gap: 14 }}>
                    <div>
                        <label htmlFor="fa-asset-ticker" style={LABEL_STYLE}>
                            {t("pages.lead_settings.financial.crypto.ticker")}
                        </label>
                        <input
                            id="fa-asset-ticker"
                            className="dr-input"
                            value={assetTicker}
                            maxLength={10}
                            disabled={assetForm?.editing != null}
                            onChange={(event) => setAssetTicker(event.target.value.toUpperCase())}
                            autoFocus={!assetForm?.editing}
                        />
                    </div>
                    <div>
                        <label htmlFor="fa-asset-provider" style={LABEL_STYLE}>
                            {t("pages.lead_settings.financial.crypto.provider_id")}
                        </label>
                        <input id="fa-asset-provider" className="dr-input" value={assetProviderId} maxLength={120} onChange={(event) => setAssetProviderId(event.target.value)} />
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: T.TEXT_MUTED }}>{t("pages.lead_settings.financial.crypto.provider_id_help")}</p>
                    </div>
                    <div>
                        <label htmlFor="fa-asset-name" style={LABEL_STYLE}>
                            {t("pages.lead_settings.financial.crypto.name")}
                        </label>
                        <input id="fa-asset-name" className="dr-input" value={assetName} maxLength={120} onChange={(event) => setAssetName(event.target.value)} />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

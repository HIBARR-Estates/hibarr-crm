import { RefObject, useMemo, useState } from "react";
import { Dropdown } from "antd";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { FieldOptionGroup } from "../config/builderFields";

interface TagPickerButtonProps {
    groups: FieldOptionGroup[];
    targetRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    value: string;
    onChange: (next: string) => void;
}

/**
 * "Insert a merge tag" button — mirrors _tag-picker.blade.php: lets you pick
 * a field from every available group instead of memorizing `{{tag}}` syntax,
 * then inserts it at the current cursor position in the paired input.
 */
export default function TagPickerButton({ groups, targetRef, value, onChange }: TagPickerButtonProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return groups;
        return groups
            .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(q)) }))
            .filter((g) => g.options.length > 0);
    }, [groups, query]);

    function insert(tag: string) {
        const text = `{{${tag}}}`;
        const el = targetRef.current;
        const start = el?.selectionStart ?? value.length;
        const end = el?.selectionEnd ?? value.length;
        const next = value.slice(0, start) + text + value.slice(end);
        onChange(next);
        setOpen(false);
        setQuery("");
        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            const pos = start + text.length;
            el.setSelectionRange(pos, pos);
        });
    }

    return (
        <Dropdown
            trigger={["click"]}
            open={open}
            onOpenChange={setOpen}
            dropdownRender={() => (
                <div
                    className="rounded-lg flex flex-col"
                    style={{
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        boxShadow: "0 8px 24px rgba(22,41,77,.16)",
                        width: 260,
                        maxHeight: 320,
                    }}
                >
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("app.automation.searchFields")}
                        className="dr-input w-full shrink-0"
                        style={{ margin: 8, marginBottom: 6, width: "calc(100% - 16px)", fontSize: 12 }}
                    />
                    <div className="overflow-y-auto" style={{ padding: "0 8px 8px" }}>
                        {filtered.length === 0 && (
                            <div className="px-1.5 py-2" style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                {t("app.automation.noFieldsMatch")}
                            </div>
                        )}
                        {filtered.map((g) => (
                            <div key={g.label}>
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: T.TEXT_HINT,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        padding: "6px 4px 2px",
                                    }}
                                >
                                    {g.label}
                                </div>
                                {g.options.map((o) => (
                                    <button
                                        key={o.value}
                                        type="button"
                                        onClick={() => insert(String(o.value))}
                                        className="dr-menu-item w-full text-left"
                                        style={{ fontSize: 13 }}
                                    >
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        >
            <button
                type="button"
                aria-label={t("app.automation.insertMergeTag")}
                className="inline-flex items-center justify-center rounded-md border-0 bg-transparent cursor-pointer"
                style={{ padding: 3, color: T.TEXT_HINT }}
                title={t("app.automation.insertMergeTag")}
            >
                <Icon name="tag" size={13} />
            </button>
        </Dropdown>
    );
}

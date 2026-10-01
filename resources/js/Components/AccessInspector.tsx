import { useMemo, useState, type ReactNode } from "react";
import { Popover } from "antd";
import { usePage } from "@inertiajs/react";
import { useTranslation } from "@/Hooks/useTranslation";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import {
    Badge,
    Button,
    Icon,
    Segmented,
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign";
import type { PermissionScope } from "@/Types/permission";

type Tab = "flags" | "permissions";

const SCOPE_NAMES: Record<number, string> = {
    4: "all",
    3: "both",
    2: "owned",
    1: "added",
    5: "none",
};

function scopeLabel(scope: PermissionScope | undefined): string {
    if (scope === undefined || scope === null) {
        return "none";
    }
    if (typeof scope === "number") {
        return SCOPE_NAMES[scope] ?? String(scope);
    }
    return scope;
}

function scopeVariant(
    scope: PermissionScope | undefined,
): "green" | "navy" | "amber" | "gray" {
    const label = scopeLabel(scope);
    if (label === "all") {
        return "green";
    }
    if (label === "both") {
        return "navy";
    }
    if (label === "owned" || label === "added") {
        return "amber";
    }
    return "gray";
}

/**
 * Read-only flags + permissions inspector. Admin in all envs; anyone on Vite
 * DEV so local non-admin debugging still works. Does not mutate remote flags.
 */
export default function AccessInspector() {
    const isAdmin = useIsAdminRole();
    const { t } = useTranslation();
    const { props } = usePage();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>("flags");
    const [query, setQuery] = useState("");

    const flags = props.featureFlags ?? {};
    const permissions = props.auth?.permissions ?? {};

    const visible = isAdmin || import.meta.env.DEV;

    const flagRows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return Object.entries(flags)
            .filter(([name]) => !q || name.toLowerCase().includes(q))
            .sort(([a], [b]) => a.localeCompare(b));
    }, [flags, query]);

    const permissionRows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return Object.entries(permissions)
            .filter(([name]) => !q || name.toLowerCase().includes(q))
            .sort(([a], [b]) => a.localeCompare(b));
    }, [permissions, query]);

    const enabledFlagCount = useMemo(
        () => Object.values(flags).filter(Boolean).length,
        [flags],
    );
    const grantedPermissionCount = useMemo(
        () =>
            Object.values(permissions).filter((scope) => {
                const label = scopeLabel(scope);
                return label !== "none";
            }).length,
        [permissions],
    );

    if (!visible) {
        return null;
    }

    const content = (
        <div
            style={{
                width: 360,
                fontFamily: REDESIGN_FONT_STACK,
            }}
        >
            <div style={{ padding: "14px 16px 12px" }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.TEXT_HINT,
                    }}
                >
                    {t("app.access_inspector.title")}
                </div>
                <div style={{ marginTop: 10 }}>
                    <Segmented<Tab>
                        value={tab}
                        onChange={(next) => {
                            setTab(next);
                            setQuery("");
                        }}
                        fullWidth
                        ariaLabel={t("app.access_inspector.title")}
                        options={[
                            {
                                value: "flags",
                                label: t("app.access_inspector.flags"),
                                count: enabledFlagCount,
                            },
                            {
                                value: "permissions",
                                label: t("app.access_inspector.permissions"),
                                count: grantedPermissionCount,
                            },
                        ]}
                    />
                </div>
                <div style={{ marginTop: 10, position: "relative" }}>
                    <span
                        style={{
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            pointerEvents: "none",
                            color: T.TEXT_HINT,
                        }}
                    >
                        <Icon name="search" size={13} />
                    </span>
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={
                            tab === "flags"
                                ? t("app.access_inspector.search_flags")
                                : t("app.access_inspector.search_permissions")
                        }
                        style={{
                            width: "100%",
                            boxSizing: "border-box",
                            height: 32,
                            padding: "0 10px 0 30px",
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: REDESIGN_RADIUS.SM,
                            background: T.WHITE,
                            color: T.TEXT,
                            fontFamily: REDESIGN_FONT_STACK,
                            fontSize: REDESIGN_TYPE.BODY,
                            outline: "none",
                        }}
                    />
                </div>
            </div>
            <div
                style={{
                    maxHeight: 280,
                    overflowY: "auto",
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                {tab === "flags" ? (
                    flagRows.length === 0 ? (
                        <EmptyRow label={t("app.access_inspector.empty")} />
                    ) : (
                        flagRows.map(([name, on]) => (
                            <Row key={name} name={name}>
                                <Badge variant={on ? "green" : "gray"}>
                                    {on
                                        ? t("app.access_inspector.on")
                                        : t("app.access_inspector.off")}
                                </Badge>
                            </Row>
                        ))
                    )
                ) : permissionRows.length === 0 ? (
                    <EmptyRow label={t("app.access_inspector.empty")} />
                ) : (
                    permissionRows.map(([name, scope]) => (
                        <Row key={name} name={name}>
                            <Badge variant={scopeVariant(scope)}>
                                {scopeLabel(scope)}
                            </Badge>
                        </Row>
                    ))
                )}
            </div>
            <div
                style={{
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                    background: T.SURFACE_2,
                    padding: "8px 16px",
                    fontSize: REDESIGN_TYPE.CAPTION,
                    color: T.TEXT_HINT,
                }}
            >
                {t("app.access_inspector.read_only")}
            </div>
        </div>
    );

    return (
        <Popover
            content={content}
            trigger="click"
            placement="bottomRight"
            arrow={{ pointAtCenter: true }}
            open={open}
            onOpenChange={setOpen}
            styles={{
                body: {
                    padding: 0,
                    overflow: "hidden",
                    borderRadius: REDESIGN_RADIUS.MD,
                    boxShadow:
                        "0 10px 28px rgba(22, 41, 77, 0.10), 0 1px 3px rgba(22, 41, 77, 0.06)",
                },
            }}
        >
            <span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<Icon name="lock" size={14} />}
                    aria-label={t("app.access_inspector.title")}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                >
                    <span className="hidden lg:inline">
                        {t("app.access_inspector.title")}
                    </span>
                </Button>
            </span>
        </Popover>
    );
}

function Row({
    name,
    children,
}: {
    name: string;
    children: ReactNode;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 16px",
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <span
                style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: REDESIGN_TYPE.CAPTION,
                    color: T.TEXT,
                    fontVariantNumeric: "tabular-nums",
                }}
                title={name}
            >
                {name}
            </span>
            {children}
        </div>
    );
}

function EmptyRow({ label }: { label: string }) {
    return (
        <div
            style={{
                padding: "20px 16px",
                textAlign: "center",
                fontSize: REDESIGN_TYPE.BODY,
                color: T.TEXT_HINT,
            }}
        >
            {label}
        </div>
    );
}

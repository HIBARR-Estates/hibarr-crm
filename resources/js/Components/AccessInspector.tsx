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
    Switch,
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign";
import { pageAccessFor } from "@/lib/pageAccess";
import type { PermissionKey, PermissionScope } from "@/Types/permission";

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

function isGranted(scope: PermissionScope | undefined): boolean {
    return scopeLabel(scope) !== "none";
}

/**
 * Read-only flags + permissions inspector. Admin in all envs; anyone on Vite
 * DEV so local non-admin debugging still works. Does not mutate remote flags.
 *
 * "This page" (default on) limits the lists to entry gates in pageAccess.ts.
 * An uncatalogued page keeps the full catalogs.
 */
export default function AccessInspector() {
    const isAdmin = useIsAdminRole();
    const { t } = useTranslation();
    const page = usePage();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>("flags");
    const [query, setQuery] = useState("");
    const [pageOnly, setPageOnly] = useState(true);

    const flags = page.props.featureFlags ?? {};
    const permissions = page.props.auth?.permissions ?? {};

    // `import.meta.env` only exists under the Vite pipeline — webpack/Mix
    // leaves `import.meta.env` undefined, which previously crashed this
    // component. Fall back to NODE_ENV there.
    const isDev =
        import.meta.env?.DEV === true ||
        (typeof process !== "undefined" &&
            process?.env?.NODE_ENV === "development");
    const visible = isAdmin || isDev;

    const entry = pageOnly ? pageAccessFor(page.component) : undefined;
    const pageScoped = pageOnly && entry !== undefined;
    const showUndeclared = pageOnly && entry === undefined;

    const scopedFlags = useMemo(() => {
        if (!pageScoped || !entry) {
            return flags;
        }
        const next: Record<string, boolean> = {};
        for (const name of entry.flags ?? []) {
            next[name] = flags[name] === true;
        }
        return next;
    }, [pageScoped, entry, flags]);

    const scopedPermissions = useMemo(() => {
        if (!pageScoped || !entry) {
            return permissions;
        }
        const next: Record<string, PermissionScope | undefined> = {};
        for (const gate of entry.permissions ?? []) {
            next[gate.key] = permissions[gate.key as PermissionKey];
        }
        return next;
    }, [pageScoped, entry, permissions]);

    const requiredScopes = useMemo(() => {
        const map = new Map<string, string[]>();
        if (!pageScoped || !entry) {
            return map;
        }
        for (const gate of entry.permissions ?? []) {
            if (gate.scopes && gate.scopes.length > 0) {
                map.set(gate.key, gate.scopes);
            }
        }
        return map;
    }, [pageScoped, entry]);

    const flagRows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return Object.entries(scopedFlags)
            .filter(([name]) => !q || name.toLowerCase().includes(q))
            .sort(([a], [b]) => a.localeCompare(b));
    }, [scopedFlags, query]);

    const permissionRows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return Object.entries(scopedPermissions)
            .filter(([name]) => !q || name.toLowerCase().includes(q))
            .sort(([a], [b]) => a.localeCompare(b));
    }, [scopedPermissions, query]);

    const enabledFlagCount = useMemo(
        () => Object.values(scopedFlags).filter(Boolean).length,
        [scopedFlags],
    );
    const grantedPermissionCount = useMemo(
        () => Object.values(scopedPermissions).filter((scope) => isGranted(scope)).length,
        [scopedPermissions],
    );

    const showAnyOf =
        pageScoped &&
        entry?.permissionsMatch === "any" &&
        tab === "permissions" &&
        (entry.permissions?.length ?? 0) > 0;

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
                <div style={{ marginTop: 10 }}>
                    <Switch
                        checked={pageOnly}
                        onChange={() => setPageOnly((current) => !current)}
                        label={t("app.access_inspector.this_page")}
                        aria-label={t("app.access_inspector.this_page")}
                    />
                    {showUndeclared ? (
                        <Caption>
                            {t("app.access_inspector.undeclared")}
                        </Caption>
                    ) : null}
                </div>
            </div>
            <div
                style={{
                    maxHeight: 280,
                    overflowY: "auto",
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                {showAnyOf ? (
                    <Caption inset>{t("app.access_inspector.any_of")}</Caption>
                ) : null}
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
                    permissionRows.map(([name, scope]) => {
                        const scopes = requiredScopes.get(name);
                        return (
                            <Row
                                key={name}
                                name={name}
                                hint={
                                    scopes
                                        ? t("app.access_inspector.needs", {
                                              scopes: scopes.join(", "),
                                          })
                                        : undefined
                                }
                            >
                                <Badge variant={scopeVariant(scope)}>
                                    {scopeLabel(scope)}
                                </Badge>
                            </Row>
                        );
                    })
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

function Caption({
    children,
    inset = false,
}: {
    children: ReactNode;
    inset?: boolean;
}) {
    return (
        <div
            style={{
                marginTop: 8,
                padding: inset ? "0 16px" : undefined,
                fontSize: REDESIGN_TYPE.CAPTION,
                color: T.TEXT_HINT,
                lineHeight: 1.4,
            }}
        >
            {children}
        </div>
    );
}

function Row({
    name,
    hint,
    children,
}: {
    name: string;
    hint?: string;
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
            {hint ? (
                <span
                    style={{
                        flexShrink: 0,
                        fontSize: REDESIGN_TYPE.CAPTION,
                        color: T.TEXT_HINT,
                    }}
                >
                    {hint}
                </span>
            ) : null}
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

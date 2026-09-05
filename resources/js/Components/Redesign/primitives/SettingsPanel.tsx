import type { ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "../tokens";

interface SettingsPanelProps {
    children: ReactNode;
    /** Stack children vertically with a gap — for a panel holding more than one field/toggle. */
    stack?: boolean;
}

/** The muted, bordered box used to group a related set of fields/toggles within a modal. */
export default function SettingsPanel({ children, stack = false }: SettingsPanelProps) {
    return (
        <div
            style={{
                marginTop: 18,
                padding: 16,
                background: T.SURFACE_2,
                border: `1px solid ${T.BORDER_SOFT}`,
                borderRadius: 10,
                ...(stack ? { display: "flex", flexDirection: "column" as const, gap: 14 } : {}),
            }}
        >
            {children}
        </div>
    );
}

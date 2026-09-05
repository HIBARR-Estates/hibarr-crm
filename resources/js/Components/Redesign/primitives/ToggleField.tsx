import type { ReactNode } from "react";
import Switch from "./Switch";
import { REDESIGN_TOKENS as T } from "../tokens";

interface ToggleFieldProps {
    checked: boolean;
    onChange: () => void;
    title: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
}

/** A settings-form row: a Switch with a bold title and muted description stacked beside it. */
export default function ToggleField({
    checked,
    onChange,
    title,
    description,
    disabled = false,
}: ToggleFieldProps) {
    return (
        <label
            className="flex items-start gap-[11px]"
            style={{ cursor: disabled ? "default" : "pointer" }}
        >
            <Switch checked={checked} onChange={onChange} disabled={disabled} />
            <span>
                <span
                    className="block font-semibold"
                    style={{ fontSize: 14, color: T.TEXT }}
                >
                    {title}
                </span>
                {description != null && (
                    <span
                        className="mt-px block"
                        style={{ fontSize: 12, color: T.TEXT_MUTED }}
                    >
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
}

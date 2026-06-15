import React from "react";
import { Button } from "antd";
import { router } from "@inertiajs/react";
import {
    formatExposeValidationLabel,
    type ExposeValidationWarning,
} from "@/lib/expose/formatExposeValidationLabel";

interface ExposeValidationWarningsProps {
    warnings: ExposeValidationWarning[];
    onNavigate?: (href: string) => void;
}

export const ExposeValidationWarnings: React.FC<
    ExposeValidationWarningsProps
> = ({ warnings, onNavigate }) => {
    const handleAction = (href: string) => {
        if (onNavigate) {
            onNavigate(href);
            return;
        }

        router.visit(href);
    };

    return (
        <ul className="list-disc pl-4 mt-2 space-y-2">
            {warnings.map((warning, index) => (
                <li
                    key={`${warning.field}-${index}`}
                    className={
                        warning.severity === "error" ? "text-red-600" : undefined
                    }
                >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span>
                            <strong>
                                {formatExposeValidationLabel(warning)}:
                            </strong>{" "}
                            {warning.message}
                        </span>
                        {warning.action?.href && (
                            <Button
                                type="link"
                                size="small"
                                className="!px-0 !h-auto"
                                onClick={() =>
                                    handleAction(warning.action!.href!)
                                }
                            >
                                {warning.action.label ?? "Fix"}
                            </Button>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
};

export default ExposeValidationWarnings;

import useTranslation from "@/Hooks/useTranslation";
import AssigneeField from "@/Components/Redesign/fields/AssigneeField";
import type { ComponentProps } from "react";

type Props = Omit<
    ComponentProps<typeof AssigneeField>,
    "removeLabel" | "addLabel" | "doneLabel"
> & {
    removeLabel?: string;
    addLabel?: string;
    doneLabel?: string;
};

/** Deal-branded AssigneeField with deal i18n labels. */
export default function DealAssigneeField(props: Props) {
    const { t } = useTranslation();
    return (
        <AssigneeField
            {...props}
            removeLabel={props.removeLabel ?? t("pages.deals.common.remove")}
            addLabel={props.addLabel ?? `+ ${t("pages.deals.common.add")}`}
            doneLabel={props.doneLabel ?? t("pages.deals.common.done")}
        />
    );
}

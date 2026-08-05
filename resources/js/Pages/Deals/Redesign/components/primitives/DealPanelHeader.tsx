import { ComponentProps } from "react";
import useTranslation from "@/Hooks/useTranslation";
import PanelHeader from "@/Components/Redesign/primitives/PanelHeader";

type Props = Omit<ComponentProps<typeof PanelHeader>, "closeAriaLabel"> & {
    closeAriaLabel?: string;
};

/** Deal-branded PanelHeader that defaults close aria to deal i18n. */
export default function DealPanelHeader({ closeAriaLabel, ...props }: Props) {
    const { t } = useTranslation();
    return (
        <PanelHeader
            {...props}
            closeAriaLabel={
                closeAriaLabel ?? t("pages.deals.common.close")
            }
        />
    );
}

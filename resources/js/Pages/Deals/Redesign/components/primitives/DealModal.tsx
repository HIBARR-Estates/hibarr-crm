import { ComponentProps } from "react";
import useTranslation from "@/Hooks/useTranslation";
import {
    Modal,
    ModalField as SharedModalField,
} from "@/Components/Redesign/primitives/Modal";

type ModalProps = ComponentProps<typeof Modal>;

/** Deal-branded Modal with deal i18n for the close control. */
export function DealModal({ closeAriaLabel, ...props }: ModalProps) {
    const { t } = useTranslation();
    return (
        <Modal
            {...props}
            closeAriaLabel={
                closeAriaLabel ?? t("pages.deals.common.close")
            }
        />
    );
}

export const DealModalField = SharedModalField;

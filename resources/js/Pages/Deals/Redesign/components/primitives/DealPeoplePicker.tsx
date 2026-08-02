import { ComponentProps } from "react";
import useTranslation from "@/Hooks/useTranslation";
import PeoplePicker from "@/Components/Redesign/primitives/PeoplePicker";

export type { PersonOption as DealPersonOption } from "@/Components/Redesign/primitives/PeoplePicker";

type Props = ComponentProps<typeof PeoplePicker>;

/** Deal-branded PeoplePicker with deal i18n strings. */
export default function DealPeoplePicker(props: Props) {
    const { t } = useTranslation();
    return (
        <PeoplePicker
            {...props}
            placeholder={
                props.placeholder ??
                t("pages.deals.header.team.search_employees")
            }
            getEmptyLabel={
                props.getEmptyLabel ??
                ((query) =>
                    `${t("pages.deals.header.team.no_employees_match")} "${query}"`)
            }
        />
    );
}

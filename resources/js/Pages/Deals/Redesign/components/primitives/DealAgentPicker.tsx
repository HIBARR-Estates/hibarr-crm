import { ComponentProps } from "react";
import useTranslation from "@/Hooks/useTranslation";
import AgentPicker from "@/Components/Redesign/primitives/AgentPicker";

export type { AgentOption as DealAgentOption } from "@/Components/Redesign/primitives/AgentPicker";

type Props = ComponentProps<typeof AgentPicker>;

/** Deal-branded AgentPicker with deal i18n strings. */
export default function DealAgentPicker(props: Props) {
    const { t } = useTranslation();
    return (
        <AgentPicker
            {...props}
            searchPlaceholder={
                props.searchPlaceholder ??
                t("pages.deals.header.team.search_agents")
            }
            loadingLabel={
                props.loadingLabel ?? t("pages.deals.common.loading")
            }
            emptyLabel={
                props.emptyLabel ?? t("pages.deals.header.team.no_agents_match")
            }
        />
    );
}

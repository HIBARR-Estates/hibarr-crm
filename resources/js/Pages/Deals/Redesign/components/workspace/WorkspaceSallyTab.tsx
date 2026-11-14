import SallyInsightsPanel from "@/Components/Redesign/sally/SallyInsightsPanel";

/**
 * The deal view owns one deal, so its Sally tab is the shared panel as-is.
 * (The lead view passes the lead's deals through `groupByDeal` so each card
 * says which deal the summary came from.)
 */
export default SallyInsightsPanel;

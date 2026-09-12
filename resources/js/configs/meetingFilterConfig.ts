import { FilterConfig } from "@/contexts/FilterContext";

interface MeetingFilterConfigProps {
    meetingTypes?: Array<{ id: number; name: string }>;
    /** People who appear on the viewer's meetings, as host or creator. */
    people?: Array<{ id: number; name: string }>;
    excludeFields?: string[];
}

/**
 * Filter fields for the meetings index.
 *
 * Same shape as the lead/deal/task configs, so the shared `EntityFilterModal`
 * and `ActiveFilterSentence` render this page without knowing anything about
 * meetings. Keys are the query params `MeetingsController@index` reads, and
 * the date range keeps the `date_from`/`date_to` pair the dashboard's deep
 * links already use — a filter set from a link and one set in the modal are
 * then the same filter.
 */
const createMeetingFilterConfig = ({
    meetingTypes = [],
    people = [],
    excludeFields,
}: MeetingFilterConfigProps): FilterConfig => {
    const fields: FilterConfig["fields"] = [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search by deal, lead or agenda...",
            span: 24,
            section: "General",
            sentence: "search",
        },
        {
            key: "meeting_type_id",
            facetKey: "meeting_type_id",
            label: "Meeting type",
            type: "multiselect",
            control: "pills",
            section: "General",
            sentence: "type",
            options: meetingTypes.map((type) => ({
                label: type.name,
                value: type.id,
            })),
            placeholder: "Filter by meeting type",
        },
        {
            key: "status",
            facetKey: "status",
            label: "Status",
            type: "multiselect",
            control: "pills",
            section: "General",
            sentence: "status",
            options: [
                { label: "Scheduled", value: "scheduled" },
                { label: "Completed", value: "completed" },
                { label: "Cancelled", value: "cancelled" },
            ],
            placeholder: "Filter by status",
        },
        {
            key: "location",
            facetKey: "location",
            label: "Where",
            type: "multiselect",
            control: "pills",
            section: "General",
            sentence: "location",
            options: [
                { label: "Zoho Meeting", value: "zoho" },
                { label: "Zoom", value: "zoom" },
                { label: "Microsoft Teams", value: "teams" },
                { label: "Google Meet", value: "google_meet" },
                { label: "Phone", value: "phone" },
                { label: "Office", value: "office" },
                { label: "Other location", value: "physical" },
            ],
            placeholder: "Filter by platform",
        },
        {
            key: "record_type",
            facetKey: "record_type",
            label: "Booked against",
            type: "select",
            control: "select",
            section: "General",
            sentence: "record",
            options: [
                { label: "Deals", value: "deal" },
                { label: "Leads", value: "lead" },
            ],
            placeholder: "Deals or leads",
        },
        {
            key: "host_id",
            facetKey: "host_id",
            label: "Host or creator",
            type: "multiselect",
            control: "checklist",
            section: "People",
            sentence: "host",
            options: people.map((person) => ({
                label: person.name,
                value: person.id,
            })),
            placeholder: "Filter by host",
        },
        {
            key: "attendance",
            facetKey: "attendance",
            label: "Client attendance",
            type: "multiselect",
            control: "pills",
            section: "People",
            sentence: "attendance",
            options: [
                { label: "Client attended", value: "attended" },
                { label: "Client did not attend", value: "no_show" },
            ],
            placeholder: "Filter by attendance",
        },
        {
            key: "meeting_date_range",
            label: "Meeting date",
            type: "daterange",
            control: "datePresets",
            section: "Dates",
            sentence: "meeting date",
            rangeKeys: ["date_from", "date_to"],
        },
    ];

    return {
        routeName: "meetings.index",
        title: "Meeting Filters",
        fields,
        excludeFields,
        defaultValues: {},
        only: ["meetings", "tabCounts", "hasAnyMeetings"],
    };
};

export default createMeetingFilterConfig;

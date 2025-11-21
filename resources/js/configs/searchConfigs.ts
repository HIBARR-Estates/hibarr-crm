import { SearchConfig } from "@/contexts/SearchContext";

// Deal search configuration
export const createDealSearchConfig = (): SearchConfig => ({
    routeName: "deals.index",
    placeholder: "Search deals by title, contact name, email...",
    searchKeys: ["search"],
    debounceMs: 300,
    minLength: 1,
    autoSearch: true,
});

// Lead search configuration
export const createLeadSearchConfig = (): SearchConfig => ({
    routeName: "lead-contact.index",
    placeholder: "Search leads by contact name, email...",
    searchKeys: ["search"],
    debounceMs: 300,
    minLength: 1,
    autoSearch: true,
});

// Property search configuration
export const createPropertySearchConfig = (): SearchConfig => ({
    routeName: "properties.index",
    placeholder: "Search properties by title, location...",
    searchKeys: ["search"],
    debounceMs: 300,
    minLength: 1,
    autoSearch: true,
});

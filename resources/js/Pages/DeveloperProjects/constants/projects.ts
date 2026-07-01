export const SORT_OPTIONS = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "cheapest", label: "Cheapest First" },
    { value: "most_expensive", label: "Most Expensive" },
    { value: "name_asc", label: "Name: A → Z" },
    { value: "name_desc", label: "Name: Z → A" },
    { value: "properties_desc", label: "Most Properties" },
];

export const CONSTRUCTION_STATUS_OPTIONS = [
    { value: "pre_construction", label: "Pre-construction" },
    { value: "active_construction", label: "Active Construction" },
    { value: "post_construction", label: "Post Construction" },
    { value: "complete", label: "Complete" },
];

export const PRIMARY_CATEGORY_OPTIONS = [
    { value: "residential", label: "Residential" },
    { value: "commercial", label: "Commercial" },
];

// Cohesive gradient palette keyed by first letter — dynamic value, inline style required
export const CARD_GRADIENTS: Record<string, string> = {
    A: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    B: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    C: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    D: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    E: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    F: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    G: "linear-gradient(135deg, #fda085 0%, #f6d365 100%)",
    H: "linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)",
    I: "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)",
    J: "linear-gradient(135deg, #f77062 0%, #fe5196 100%)",
    K: "linear-gradient(135deg, #c471ed 0%, #f64f59 100%)",
    L: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    M: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
    N: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)",
    O: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)",
    P: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
    Q: "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)",
    R: "linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)",
    S: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    T: "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)",
    U: "linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)",
    V: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    W: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    X: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    Y: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    Z: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
};

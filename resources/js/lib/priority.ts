export const PRIORITY_CONFIG = {
    urgent:  { color: "#dc2626", bg: "#fef2f2", textColor: "text-red-600",   label: "Urgent",  icon: "🔴" },
    highest: { color: "#ef4444", bg: "#fef2f2", textColor: "text-red-500",   label: "Highest", icon: "🔴" },
    high:    { color: "#ef4444", bg: "#fef2f2", textColor: "text-red-500",   label: "High",    icon: "🔴" },
    medium:  { color: "#f59e0b", bg: "#fffbeb", textColor: "text-amber-500", label: "Medium",  icon: "🟡" },
    low:     { color: "#94a3b8", bg: "#f8fafc", textColor: "text-slate-400", label: "Low",     icon: "⚪" },
} as const;

export type Priority = keyof typeof PRIORITY_CONFIG;

export const getPriorityConfig = (priority: string) =>
    PRIORITY_CONFIG[priority as Priority] ?? PRIORITY_CONFIG.medium;

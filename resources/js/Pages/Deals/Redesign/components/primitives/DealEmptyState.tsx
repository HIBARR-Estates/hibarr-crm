interface DealEmptyStateProps {
    title: string;
    description?: string;
}

export default function DealEmptyState({ title, description }: DealEmptyStateProps) {
    return (
        <div className="rounded-lg border border-[#e2e5ea] bg-white p-8 text-center">
            <p className="text-sm font-medium text-[#1a1f2e]">{title}</p>
            {description && <p className="mt-2 text-xs text-[#6b7280]">{description}</p>}
        </div>
    );
}

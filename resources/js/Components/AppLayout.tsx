import React, { ReactNode } from "react";
import { Head } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface AppLayoutProps {
    title: string;
    children: ReactNode;
}

export default function AppLayout({ title, children }: AppLayoutProps) {
    const { td } = useTd();
    return (
        <>
            <Head title={title} />
            <div className="min-h-screen bg-gray-100">
                {/* Navigation */}
                <nav className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex items-center">
                                <h1 className="text-xl font-semibold text-gray-900">
                                    {td("HIBARR CRM", { source: "en" })}
                                </h1>
                            </div>
                            <div className="flex items-center space-x-4">
                                <span className="text-sm text-gray-600">
                                    {td("Welcome back!", { source: "en" })}
                                </span>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <main className="py-6">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>
        </>
    );
}

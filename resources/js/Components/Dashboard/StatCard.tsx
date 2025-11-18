import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    gradient: string;
    change?: {
        value: number;
        type: "increase" | "decrease";
    };
    delay?: number;
}

export default function StatCard({
    title,
    value,
    icon: Icon,
    gradient,
    change,
    delay = 0,
}: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
        >
            {/* Gradient Background */}
            <div className={`absolute inset-0 opacity-5 ${gradient}`} />
            
            {/* Hover Gradient Effect */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 ${gradient} transition-opacity duration-300`} />
            
            <div className="relative p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600 mb-1">
                            {title}
                        </p>
                        <p className="text-3xl font-bold text-gray-900 mb-2">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </p>
                        
                        {change && (
                            <div className="flex items-center gap-1">
                                <span
                                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                                        change.type === "increase"
                                            ? "bg-green-50 text-green-700"
                                            : "bg-red-50 text-red-700"
                                    }`}
                                >
                                    {change.type === "increase" ? "+" : "-"}
                                    {Math.abs(change.value)}%
                                </span>
                                <span className="text-xs text-gray-500">
                                    vs last month
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className={`p-3 rounded-xl ${gradient} bg-opacity-10`}>
                        <Icon size={24} className="text-gray-700" />
                    </div>
                </div>
            </div>
            
            {/* Bottom border accent */}
            <div className={`h-1 ${gradient}`} />
        </motion.div>
    );
}
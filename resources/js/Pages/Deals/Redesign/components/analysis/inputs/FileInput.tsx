import { useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface FileInputProps {
    value: string;
    disabled?: boolean;
    onFileSelect: (file: File) => void;
}

export default function FileInput({ value, disabled, onFileSelect }: FileInputProps) {
    const { td } = useTd();
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0 || disabled) return;
        onFileSelect(files[0]);
    };

    const displayName = value ? value.split("/").pop() ?? value : null;

    return (
        <div className="space-y-2">
            {displayName && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="truncate">{displayName}</span>
                </div>
            )}
            <div
                onClick={() => !disabled && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer"
                style={{
                    borderColor: dragging ? "#38bdf8" : "#e2e8f0",
                    background: dragging ? "#f0f9ff" : "#f8fafc",
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                }}
            >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-slate-500 font-medium">{displayName ? td("Replace file", { source: "en" }) : td("Upload file", { source: "en" })}</span>
                <span className="text-xs text-slate-400">{td("or drag and drop", { source: "en" })}</span>
            </div>
            <input
                ref={inputRef}
                type="file"
                className="sr-only"
                disabled={disabled}
                onChange={(e) => handleFiles(e.target.files)}
            />
        </div>
    );
}

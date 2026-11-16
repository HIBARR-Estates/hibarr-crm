import { Fragment } from "react";

/** The part of a result that matches the word, marked as on the boards (a light blue block). */
export default function Highlight({ text, query }: { text: string; query: string }) {
    const word = query.trim();
    if (!word || !text) return <>{text}</>;

    const lower = text.toLocaleLowerCase();
    const needle = word.toLocaleLowerCase();
    const parts: Array<{ text: string; hit: boolean }> = [];
    let from = 0;
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
        if (at > from) parts.push({ text: text.slice(from, at), hit: false });
        parts.push({ text: text.slice(at, at + needle.length), hit: true });
        from = at + needle.length;
    }
    if (from < text.length) parts.push({ text: text.slice(from), hit: false });

    return (
        <>
            {parts.map((part, index) =>
                part.hit ? (
                    <mark key={index} className="agent-sr__mark">
                        {part.text}
                    </mark>
                ) : (
                    <Fragment key={index}>{part.text}</Fragment>
                ),
            )}
        </>
    );
}

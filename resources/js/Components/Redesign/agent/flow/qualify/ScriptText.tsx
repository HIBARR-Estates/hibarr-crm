import QualificationScriptHtml from "@/Pages/Leads/Components/Qualification/QualificationScriptHtml";
import { useTranslatedScriptLabel } from "@/Components/Redesign/qualification/useTranslatedScriptLabel";

/** A script line in the agent's language with {{tokens}} filled in, as the classic script shows it. */
export default function ScriptText({
    text,
    translateScript,
    className,
}: {
    text: string;
    translateScript: (text: string) => string;
    className?: string;
}) {
    const localized = useTranslatedScriptLabel(text);
    return <QualificationScriptHtml html={translateScript(localized)} className={className} />;
}

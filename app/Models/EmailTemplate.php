<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailTemplate extends BaseModel
{
    use HasCompany;
    use HasFactory;

    protected $table = 'email_templates';

    public const MODE_CUSTOM = 'custom';

    public const MODE_PLUNK_BODY = 'plunk_body';

    public const MODES = [
        self::MODE_CUSTOM => 'Custom Template',
        self::MODE_PLUNK_BODY => 'Plunk Base Template (inject body)',
    ];

    protected $fillable = [
        'company_id',
        'name',
        'mode',
        'subject',
        'preheader',
        'body',
        'plunk_template_id',
        'variable_mappings',
    ];

    protected $casts = [
        'variable_mappings' => 'array',
    ];

    /**
     * Deal automation actions that send this template.
     */
    public function automationActions(): HasMany
    {
        return $this->hasMany(DealAutomationAction::class, 'email_template_id');
    }

    /**
     * variable_mappings as a flat "variable name" => mapping-config lookup,
     * used to resolve {{variable}} tags and Plunk template variables.
     *
     * Each config is either:
     *   ['type' => 'field', 'field' => 'lead_field_client_name']
     *   ['type' => 'cta_url', 'cta_target' => 'record'|'deal'|'lead'|'custom', 'cta_custom_url' => ?string]
     *
     * Rows saved before the CTA URL feature existed have no 'type' key and
     * are treated as 'field' for backward compatibility.
     *
     * @return array<string, array<string, mixed>>
     */
    public function variableMappingConfig(): array
    {
        $map = [];

        foreach ($this->variable_mappings ?? [] as $mapping) {
            $variable = trim((string) ($mapping['variable'] ?? ''));

            if ($variable === '') {
                continue;
            }

            if (($mapping['type'] ?? 'field') === 'cta_url') {
                $map[$variable] = [
                    'type' => 'cta_url',
                    'cta_target' => $mapping['cta_target'] ?? 'record',
                    'cta_custom_url' => $mapping['cta_custom_url'] ?? null,
                ];

                continue;
            }

            $field = trim((string) ($mapping['field'] ?? ''));

            if ($field !== '') {
                $map[$variable] = ['type' => 'field', 'field' => $field];
            }
        }

        return $map;
    }

    /**
     * Whether $html already looks like a complete, self-styled HTML fragment
     * (its own <table>-based layout and/or <style> block) rather than the
     * simple paragraphs/lists/etc. the Quill body editor produces. Used to
     * (a) skip the generic 600px/padding wrapper in
     * mail.deal-automation-template so a fully custom-designed email renders
     * exactly as authored, and (b) default the edit form's Body field into
     * raw HTML-source mode instead of the Visual (Quill) editor — Quill has
     * no <table>/<style> blots and parses its *own* starting innerHTML
     * through the same sanitizing pipeline as a paste, so it would mangle
     * this on every page load, not just on paste.
     */
    public static function bodyLooksLikeFullHtml(?string $html): bool
    {
        return $html !== null && preg_match('/<(table|style)\b/i', $html) === 1;
    }

    /**
     * Detect bodies where HTML tags were stripped (e.g. pasted through Quill)
     * but CSS rules / merge tags remain as plain text — preview and sends
     * will look like an unformatted wall of text in that state.
     */
    public static function bodyLooksStripped(?string $html): bool
    {
        if ($html === null || trim($html) === '') {
            return false;
        }

        if (preg_match('/<(table|style|div|td|tr|p|a|img)\b/i', $html) === 1) {
            return false;
        }

        return preg_match('/\.hm\b|@media\s/i', $html) === 1
            || preg_match('/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/', $html) === 1;
    }

    /**
     * Whether $html is already a full HTML document (not just a fragment).
     */
    public static function bodyIsCompleteHtmlDocument(?string $html): bool
    {
        return $html !== null && preg_match('/<!DOCTYPE\s+html|<html[\s>]/i', $html) === 1;
    }

    /**
     * Render a preview/send-ready HTML document for this template's body.
     * Used by the live preview endpoint and the index "Preview" popup.
     */
    public static function renderPreviewHtml(
        string $body,
        ?string $subject = null,
        ?string $preheader = null,
        ?string $templateMode = self::MODE_CUSTOM,
    ): string {
        if (self::bodyIsCompleteHtmlDocument($body)) {
            return $body;
        }

        return view('mail.deal-automation-template', [
            'bodyHtml' => $body,
            'preheader' => $preheader,
            'subject' => $subject,
            'isPreview' => true,
            'templateMode' => $templateMode ?? self::MODE_CUSTOM,
        ])->render();
    }
}

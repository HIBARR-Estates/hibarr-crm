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
     * simple paragraphs/lists/etc. the Quill body editor produces. Used only
     * to default the classic edit form's Body field into raw HTML-source
     * mode instead of the Visual (Quill) editor — Quill has no <table>/<style>
     * blots and parses its *own* starting innerHTML
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

        return preg_match('/\.hm\b|@media\s/i', $html) === 1;
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
     *
     * $resolveSamples only applies on the preview path: merge tags are
     * substituted with realistic sample values (like every ESP's preview)
     * instead of showing raw {{tags}}, which reads as broken markup —
     * especially when a tag sits inside an href. Real sends never pass this
     * flag, so their tags keep resolving against the actual deal/lead via
     * DealAutomationService::renderTemplateText().
     */
    public static function renderPreviewHtml(
        string $body,
        ?string $subject = null,
        ?string $preheader = null,
        ?string $templateMode = self::MODE_CUSTOM,
        bool $resolveSamples = false,
    ): string {
        if ($resolveSamples) {
            $subject = self::resolveSampleTags($subject);
            $preheader = self::resolveSampleTags($preheader);
            $body = self::resolveSampleTags($body);
        }

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

    /**
     * Replace every {{tag}} in $text with a realistic sample value.
     */
    public static function resolveSampleTags(?string $text): ?string
    {
        if ($text === null || $text === '') {
            return $text;
        }

        return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($matches) {
            return self::sampleValueFor($matches[1]);
        }, $text);
    }

    /**
     * A believable sample value for one merge tag, guessed from its name.
     * Keyword matching is deliberately loose — the goal is a preview that
     * reads like a real send, not exact field typing.
     */
    public static function sampleValueFor(string $tag): string
    {
        $tag = strtolower($tag);

        $contains = fn (array $needles) => collect($needles)->contains(fn ($n) => str_contains($tag, $n));

        if ($contains(['url', 'link', 'cta'])) {
            return 'https://example.com/view';
        }

        if ($contains(['email'])) {
            return 'jane.doe@example.com';
        }

        if ($contains(['mobile', 'phone', 'cell', 'office', 'whatsapp', 'telegram'])) {
            return '+49 151 234 5678';
        }

        if ($contains(['instagram', 'website'])) {
            return '@janedoe';
        }

        if ($contains(['date', '_at', 'day'])) {
            return now()->format('M j, Y');
        }

        if ($contains(['time']) && ! $contains(['timeline'])) {
            return now()->format('g:i A');
        }

        if ($contains(['name'])) {
            if ($contains(['assignedby', 'agent', 'owner', 'user', 'author'])) {
                return 'Mark Taylor';
            }

            return $contains(['company'])
                ? 'Doe Properties Ltd.'
                : 'Jane Doe';
        }

        if ($contains(['value', 'price', 'budget', 'amount', 'deposit', 'payment'])) {
            return '€250,000';
        }

        if ($contains(['count', 'days_ago', 'age', 'number'])) {
            return '3';
        }

        if ($contains(['country'])) {
            return 'Germany';
        }

        if ($contains(['city'])) {
            return 'Berlin';
        }

        if ($contains(['status', 'stage', 'temperature', 'type', 'source', 'gender'])) {
            return ucfirst(str_replace('_', ' ', $tag));
        }

        // Fallback: Title Cased Tag Name
        return ucwords(str_replace('_', ' ', $tag));
    }
}

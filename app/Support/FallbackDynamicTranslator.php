<?php

namespace App\Support;

use App\Services\DynamicTranslationService;
use Illuminate\Translation\Translator;

/**
 * Translator that machine-translates legacy lang keys with no de/tr/ru value.
 *
 * The legacy lang files (app, modules, messages, email, permissions) are mostly
 * untranslated outside English. Instead of showing English, a missing value is
 * translated from the English text through DynamicTranslationService (cached,
 * queued on first use). Strings with placeholders, plural forms or markup are
 * left untouched so tokens like :name are never mangled.
 *
 * Enabled with DYNAMIC_TRANSLATION_LEGACY_LANG_FALLBACK=true.
 */
class FallbackDynamicTranslator extends Translator
{
    private const TARGET_LOCALES = ['de', 'tr', 'ru'];

    private const GROUPS = ['app', 'modules', 'messages', 'email', 'permissions'];

    public function get($key, array $replace = [], $locale = null, $fallback = true)
    {
        $line = parent::get($key, $replace, $locale, $fallback);

        try {
            $locale = $locale ?: $this->locale();

            if (! $fallback || ! in_array($locale, self::TARGET_LOCALES, true) || ! is_string($key)) {
                return $line;
            }

            [$group] = explode('.', $key, 2);

            if (str_contains($key, '::') || ! in_array($group, self::GROUPS, true) || $line === $key) {
                return $line;
            }

            if ($this->hasForLocale($key, $locale)) {
                return $line;
            }

            $english = parent::get($key, [], $this->getFallback(), false);

            if (! is_string($english) || $english === $key || trim($english) === ''
                || preg_match('/:[A-Za-z_]+|\{|\||<[a-z]/i', $english)
                || ! preg_match('/[A-Za-z]{2,}/', $english)) {
                return $line;
            }

            $translated = app(DynamicTranslationService::class)->translate($english, $locale);

            return $this->makeReplacements($translated, $replace);
        } catch (\Throwable $exception) {
            return $line;
        }
    }
}

<?php

namespace App\Support;

use ErrorException;
use HTMLPurifier;
use HTMLPurifier_Config;

/**
 * Allow-list sanitizer for user-authored rich text (Quill editor output).
 *
 * Keeps what the editors produce: headings, lists, alignment/indent classes,
 * colours, links (including target="_blank"), images (including data:image),
 * YouTube and Vimeo embeds, and @mention spans with their data-* attributes.
 * Drops anything that can run script: event handlers, javascript: URLs,
 * <script>, <style>, <svg> and other iframes.
 */
class HtmlSanitizer
{
    /** Bump when the allow-list below changes, so cached HTML definitions are rebuilt. */
    private const DEFINITION_REVISION = 1;

    private static ?HTMLPurifier $purifier = null;

    public static function clean(?string $html): ?string
    {
        if ($html === null || !self::containsMarkup($html)) {
            return $html;
        }

        try {
            return self::purifier()->purify($html);
        } catch (ErrorException) {
            // HTMLPurifier warns when it can't write its definition cache; carry on without the cache.
            self::$purifier = new HTMLPurifier(self::config(false));

            return self::$purifier->purify($html);
        }
    }

    /**
     * A browser only starts a tag, comment or doctype when "<" is followed by a
     * letter, "/", "!" or "?". Text without that ("a < b", "<3") can't create
     * elements, so it is returned as-is instead of being entity-encoded.
     */
    public static function containsMarkup(string $value): bool
    {
        return preg_match('/<[a-z\/!?]/i', $value) === 1;
    }

    private static function purifier(): HTMLPurifier
    {
        return self::$purifier ??= new HTMLPurifier(self::config(true));
    }

    private static function config(bool $useCache): HTMLPurifier_Config
    {
        $config = HTMLPurifier_Config::createDefault();
        $cachePath = storage_path('framework/cache/htmlpurifier');

        if ($useCache && (is_dir($cachePath) || @mkdir($cachePath, 0755, true)) && is_writable($cachePath)) {
            $config->set('Cache.SerializerPath', $cachePath);
        } else {
            $config->set('Cache.DefinitionImpl', null);
        }

        $config->set('HTML.DefinitionID', 'rich-text');
        $config->set('HTML.DefinitionRev', self::DEFINITION_REVISION);
        $config->set('Attr.AllowedFrameTargets', ['_blank']);
        $config->set('Attr.DefaultImageAlt', '');
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true, 'tel' => true, 'data' => true]);
        $config->set('HTML.SafeIframe', true);
        $config->set('URI.SafeIframeRegexp', '%^https://(www\.youtube(-nocookie)?\.com/embed/|player\.vimeo\.com/video/)%');

        if ($definition = $config->maybeGetRawHTMLDefinition()) {
            // quill-mention
            foreach (['data-id', 'data-value', 'data-denotation-char', 'data-index', 'data-link'] as $attribute) {
                $definition->addAttribute('span', $attribute, 'Text');
            }

            $definition->addAttribute('span', 'contenteditable', 'Enum#false');
            // Quill video embeds
            $definition->addAttribute('iframe', 'allowfullscreen', 'Bool#allowfullscreen');
        }

        return $config;
    }
}

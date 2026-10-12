<?php

namespace App\Email\Support;

use ErrorException;
use HTMLPurifier;
use HTMLPurifier_Config;

/**
 * Turns the HTML a stranger sent into HTML the CRM may show. Runs inside the
 * CRM (HTML Purifier) — mail is never handed to an outside service for it.
 *
 * Kept: text structure, tables, basic inline styling, and links, which open
 * in a new tab with no referrer.
 * Removed: anything that runs (script, event handlers, javascript: URLs),
 * anything that frames or submits (iframe, object, form), style sheets, and
 * every embedded resource — images included — so opening a message loads
 * nothing from anywhere and tells the sender nothing.
 *
 * This is deliberately not App\Support\HtmlSanitizer: that one is for rich
 * text our own users write, and allows images and video embeds.
 */
class EmailHtmlSanitizer
{
    /** Bump when the configuration below changes, so cached definitions are rebuilt. */
    private const DEFINITION_REVISION = 1;

    private static ?HTMLPurifier $purifier = null;

    public function clean(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return null;
        }

        try {
            $safe = self::purifier()->purify($html);
        } catch (ErrorException) {
            // HTMLPurifier warns when it can't write its definition cache; carry on without the cache.
            self::$purifier = new HTMLPurifier(self::config(false));

            $safe = self::$purifier->purify($html);
        }

        return trim($safe) === '' ? null : $safe;
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

        $config->set('HTML.DefinitionID', 'email');
        $config->set('HTML.DefinitionRev', self::DEFINITION_REVISION);

        // Nothing is fetched to show a message: no images, no CSS url(), from any source.
        $config->set('URI.DisableResources', true);
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true, 'tel' => true]);
        $config->set('CSS.ForbiddenProperties', [
            'background' => true,
            'background-image' => true,
            'list-style' => true,
            'list-style-image' => true,
        ]);

        // Links leave the CRM in a new tab, without a referrer or a handle on the opener.
        $config->set('HTML.TargetBlank', true);
        $config->set('HTML.Nofollow', true);
        $config->set('HTML.ForbiddenElements', ['img']);
        $config->set('Attr.EnableID', false);

        return $config;
    }
}

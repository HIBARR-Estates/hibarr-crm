<?php

namespace App\Http\Middleware;

use App\Support\HtmlSanitizer;
use Closure;
use Illuminate\Http\Request;
use Nwidart\Modules\Facades\Module;

/**
 * Froiden's global XSS middleware strip_tags() every input value except the
 * keys in config/xss_ignore.php (editor fields such as description, notes and
 * message), which it passes through exactly as sent. This runs those values
 * through the rich-text allow-list instead, so formatting survives but
 * scripts and event handlers don't. It also covers PATCH, which the XSS
 * middleware skips.
 */
class SanitizeRichTextInput
{
    /**
     * Email template fields (Settings > Automation > Email Templates): full HTML
     * documents authored by admins with manage_company_setting, kept raw on purpose.
     */
    private const RAW_HTML_KEYS = ['body', 'subject', 'preheader'];

    public function handle(Request $request, Closure $next)
    {
        if (!in_array($request->method(), ['POST', 'PUT', 'PATCH'], true)) {
            return $next($request);
        }

        $keys = array_diff($this->richTextKeys(), self::RAW_HTML_KEYS);
        $changed = [];

        foreach ($request->input() as $key => $value) {
            $clean = $this->sanitize($key, $value, $keys);

            if ($clean !== $value) {
                $changed[$key] = $clean;
            }
        }

        if ($changed) {
            $request->merge($changed);
        }

        return $next($request);
    }

    private function sanitize(int|string $key, mixed $value, array $keys): mixed
    {
        if (is_array($value)) {
            foreach ($value as $childKey => $child) {
                $value[$childKey] = $this->sanitize($childKey, $child, $keys);
            }

            return $value;
        }

        // Same rule as the XSS middleware: the innermost key decides.
        return is_string($value) && in_array($key, $keys, true) ? HtmlSanitizer::clean($value) : $value;
    }

    private function richTextKeys(): array
    {
        $keys = config('xss_ignore', []);

        if (class_exists(Module::class)) {
            foreach (Module::allEnabled() as $module) {
                $keys = array_merge($keys, config(strtolower($module->getName()) . '::xss_ignore', []));
            }
        }

        return $keys;
    }
}

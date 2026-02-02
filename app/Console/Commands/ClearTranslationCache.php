<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class ClearTranslationCache extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'translations:clear {locale?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clear cached translations for all locales or a specific locale';

    /**
     * Supported locales that may have cached translations
     */
    protected array $supportedLocales = ['en', 'ar', 'ru', 'tr', 'de', 'fa'];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $locale = $this->argument('locale');

        if ($locale) {
            // Clear specific locale
            $this->clearLocaleCache($locale);
            $this->info("Translation cache cleared for locale: {$locale}");
        } else {
            // Clear all locales
            foreach ($this->supportedLocales as $loc) {
                $this->clearLocaleCache($loc);
            }
            $this->info('Translation cache cleared for all locales.');
        }

        return Command::SUCCESS;
    }

    /**
     * Clear the cache for a specific locale
     */
    protected function clearLocaleCache(string $locale): void
    {
        Cache::forget("translations_{$locale}");
        $this->line("  - Cleared: translations_{$locale}");
    }
}

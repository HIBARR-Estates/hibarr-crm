<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Support\FeatureFlags;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * RTL locales for right-to-left text direction
     */
    // None of the four supported languages (en, de, ru, tr) are RTL
    protected array $rtlLocales = [];

    /**
     * Locale to language folder mapping
     */
    protected array $localeToFolder = [
        'en' => 'eng',
        'de' => 'de',
        'ru' => 'ru',
        'tr' => 'tr',
    ];

    /**
     * The root template that's loaded on the first page visit.
     */
    // protected $rootView = 'layouts.inertia_vite';
    protected $rootView = 'layouts.inertia_alt';

    /**
     * Get the root view based on the bundler configuration.
     */
    // public function rootView(Request $request): string
    // {
    //     $bundler = config('app.bundler', env('APP_BUNDLER'));
        
    //     return $bundler === 'vite' 
    //         ? 'layouts.inertia_vite'
    //         : 'layouts.inertia_alt';
    // }

    /**
     * Determines the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Defines the props that are shared by default.
     */
    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => fn () => [
                'user' => auth()->user() ? $this->getUserWithLeadAgentId() : null,
                'permissions' => function_exists('user') ? $this->getAllPermissions() : [],
                'modules' => function_exists('user_modules') ? user_modules() : [],
            ],
            'default_currency_symbol' => fn () => $this->getDefaultCurrencySymbol(),
            'default_currency_code' => fn () => $this->getDefaultCurrencyCode(),
            'currencies' => fn () => $this->getCompanyCurrencies(),
            'countries' => fn () => $this->getCountries(),
            'errors' => fn () => $request->session()->get('errors')
                ? $request->session()->get('errors')->getBag('default')->getMessages()
                : (object) [],
            'flash' => [
                'property' => fn () => $request->session()->get('property'),
                'message' => fn () => $request->session()->get('message'),
                'error' => fn () => $request->session()->get('error'),
                'success' => fn () => $request->session()->get('success'),
            ],
            'csrf_token' => csrf_token(),
            'app_url' => config('app.url'),
            'company' => function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting() : null,
            'appName' => function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting()->app_name ?? config('app.name') : config('app.name'),
            'appTheme' => function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting() : null,
            // TODO: Remove sidebar props once refactor is complete
            'sidebar' => [
                'permissions' => function_exists('user') ? $this->getAllPermissions() : [],
                'modules' => function_exists('user_modules') ? user_modules() : [],
                'unreadMessagesCount' => function_exists('user') && user() ? $this->getUnreadMessagesCount() : 0,
                'customLinks' => function_exists('user') ? $this->getCustomLinks() : [],
                'worksuitePlugins' => function_exists('user') ? $this->getWorksuitePlugins() : [],
            ],
            'currentRouteName' => $request->route() ? $request->route()->getName() : '',
            'pipelines' => fn () => $this->getPipelines(),

            // Internationalization props
            'locale' => fn () => $this->getCurrentLocale(),
            'translations' => fn () => $this->getTranslations(),
            'fallbackTranslations' => fn () => $this->getFallbackTranslations(),
            'isRtl' => fn () => $this->isRtlLocale(),
            'availableLocales' => fn () => $this->getAvailableLocales(),
            'featureFlags' => fn () => FeatureFlags::forInertia(),
        ]);
    }
     /**
     * Get default currency symbol safely
     */
    private function getDefaultCurrencySymbol(): ?string
    {
        try {
            $company = function_exists('company') ? company() : null;
            
            if (!$company || !$company->currency) {
                return null;
            }
            
            return $company?->currency?->currency_symbol;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Get default currency code safely
     */
    private function getDefaultCurrencyCode(): ?string
    {
        try {
            $company = function_exists('company') ? company() : null;
            
            if (!$company || !$company->currency) {
                return null;
            }

            return $company?->currency?->currency_code;
        } catch (\Exception $e) {
            return null;
        }
    }

        /**
     * Get company currencies safely
     */
    private function getCompanyCurrencies()
    {
        try {
            $company = function_exists('company') ? company() : null;
            
            if (!$company) {
                return [];
            }

            // Load currencies relationship and convert to array
            $currencies = $company->currencies()->get();
            
            // Return as array with all necessary fields
            return $currencies->map(function ($currency) {
                return [
                    'id' => $currency->id,
                    'company_id' => $currency->company_id,
                    'currency_name' => $currency->currency_name,
                    'currency_symbol' => $currency->currency_symbol,
                    'currency_code' => $currency->currency_code,
                    'exchange_rate' => $currency->exchange_rate,
                    'is_cryptocurrency' => $currency->is_cryptocurrency,
                    'usd_price' => $currency->usd_price,
                ];
            })->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }

    /**
     * Get countries safely
     */
    private function getCountries()
    {
        try {
            // Use cache to avoid querying database on every request
            $countries = \Illuminate\Support\Facades\Cache::remember('countries_list', 3600, function () {
                return \App\Models\Country::all();
            });
            
            // Return as array with all necessary fields (including nationality)
            return $countries->map(function ($country) {
                return [
                    'id' => $country->id,
                    'iso' => $country->iso,
                    'name' => $country->name,
                    'nicename' => $country->nicename,
                    'iso3' => $country->iso3,
                    'numcode' => $country->numcode,
                    'phonecode' => $country->phonecode,
                    'nationality' => $country->nationality, // Include nationality attribute
                ];
            })->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }

  

    private function getUnreadMessagesCount(): int
    {
        // Return unread messages count - implement based on your message system
        return 0; // Placeholder
    }

    /**
     * Get the authenticated user with their LeadAgent ID appended.
     */
    private function getUserWithLeadAgentId()
    {
        $user = auth()->user()->load(['roles', 'employeeDetail.designation']);

        // Append the first lead_agent id for this user (used by invitation feature)
        $leadAgent = \App\Models\LeadAgent::where('user_id', $user->id)->first();
        $user->setAttribute('lead_agent_id', $leadAgent?->id);

        // Used by integrations feature UIs to decide whether to show an integration badge.
        $user->setAttribute('has_zoho_profile', !empty($user->employeeDetail?->zoho_id));

        return $user;
    }

    private function getCustomLinks(): array
    {
        // Return custom links based on your system
        return []; // Placeholder
    }

    private function getWorksuitePlugins(): array
    {
        // Return worksuite plugins
        return []; // Placeholder
    }

    /**
     * Get pipelines for sidebar navigation
     */
    private function getPipelines(): array
    {
        try {
            if (!function_exists('user') || !user()) {
                return [];
            }

            return \App\Models\LeadPipeline::has('stages')
                ->select('id', 'name', 'default')
                ->get()
                ->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }

    private function getAllPermissions()
    {
        if (!function_exists('user') || !user()) {
            return [];
        }

        // Get all permissions for the user in a single query
        // This joins user_permissions -> permissions -> permission_types
        $userPermissions = \App\Models\UserPermission::join('permissions', 'user_permissions.permission_id', '=', 'permissions.id')
            ->join('permission_types', 'user_permissions.permission_type_id', '=', 'permission_types.id')
            ->where('user_permissions.user_id', user()->id)
            ->select('permissions.name as permission_name', 'permission_types.name as permission_type')
            ->pluck('permission_type', 'permission_name')
            ->toArray();

        // Get all possible permissions to ensure we return a complete list
        // We cache this query as the list of all permissions rarely changes
        $allPermissions = cache()->remember('all_permissions_list', 60 * 60 * 24, function () {
            return \App\Models\Permission::pluck('name')->toArray();
        });

        $permissions = [];
        
        // Map permissions: use the user's specific permission type if it exists, otherwise default to 'none' (or 4/5 depending on your logic)
        // Assuming 'none' or a specific ID represents no permission. 
        // Based on your previous code, it seems you want the permission type name (e.g., 'all', 'added', 'owned', 'both', 'none')
        foreach ($allPermissions as $permissionName) {
            $permissions[$permissionName] = $userPermissions[$permissionName] ?? 'none';
        }

        return $permissions;
    }

    /**
     * Get current locale from user preference or session
     */
    private function getCurrentLocale(): string
    {
        // Priority: User preference > Session > App default
        if (function_exists('user') && user() && user()->locale) {
            $locale = user()->locale;
            \Log::channel('daily')->debug('[i18n] Locale resolved from user record', [
                'user_id' => user()->id,
                'locale'  => $locale,
            ]);
            return $locale;
        }

        $locale = session('locale', app()->getLocale());
        \Log::channel('daily')->debug('[i18n] Locale resolved from session/app default', [
            'session_locale' => session('locale'),
            'app_locale'     => app()->getLocale(),
            'resolved'       => $locale,
        ]);
        return $locale;
    }

    /**
     * Check if current locale is RTL
     */
    private function isRtlLocale(): bool
    {
        return in_array($this->getCurrentLocale(), $this->rtlLocales);
    }

    /**
     * Get translations for frontend (cached per locale with TTL)
     */
    private function getTranslations(): array
    {
        $locale = $this->getCurrentLocale();

        \Log::channel('daily')->debug('[i18n] getTranslations called', [
            'locale'        => $locale,
            'cache_key'     => "translations_{$locale}",
            'cache_hit'     => Cache::has("translations_{$locale}"),
        ]);

        return Cache::remember("translations_{$locale}", 3600, function () use ($locale) {
            \Log::channel('daily')->info('[i18n] Building translations from disk (cache miss)', ['locale' => $locale]);
            $files = ['app', 'modules', 'messages', 'permissions', 'placeholders', 'pages'];

            // Always load English as the base translations
            $englishPath = lang_path('eng');
            $baseTranslations = [];

            foreach ($files as $file) {
                $filePath = $englishPath . '/' . $file . '.php';
                if (file_exists($filePath)) {
                    $baseTranslations[$file] = require $filePath;
                }
            }

            // If locale is English, return English translations directly
            if ($locale === 'en') {
                return $this->flattenTranslations($baseTranslations);
            }

            // For non-English locales, overlay locale-specific translations on top of English
            $folder = $this->localeToFolder[$locale] ?? 'eng';
            $path = lang_path($folder);

            \Log::channel('daily')->info('[i18n] Loading locale files', [
                'locale' => $locale,
                'folder' => $folder,
                'path'   => $path,
                'exists' => is_dir($path),
            ]);

            if (is_dir($path)) {
                foreach ($files as $file) {
                    $filePath = $path . '/' . $file . '.php';
                    $exists   = file_exists($filePath);
                    \Log::channel('daily')->debug('[i18n] Translation file check', [
                        'file'   => $filePath,
                        'exists' => $exists,
                    ]);
                    if ($exists) {
                        $localeData = require $filePath;
                        // Deep merge: locale translations override English, missing keys keep English values
                        $baseTranslations[$file] = array_replace_recursive(
                            $baseTranslations[$file] ?? [],
                            $localeData
                        );
                    }
                }
            }

            $flat = $this->flattenTranslations($baseTranslations);
            \Log::channel('daily')->info('[i18n] Translation bundle built', [
                'locale'     => $locale,
                'key_count'  => count($flat),
                'sample_key' => array_key_first($flat) ?? 'none',
            ]);
            return $flat;
        });
    }

    /**
     * Get English fallback translations for i18next client-side fallback
     * Only sent when locale is non-English so i18next fallbackLng works
     */
    private function getFallbackTranslations(): ?array
    {
        $locale = $this->getCurrentLocale();

        // No need for fallback when already English
        if ($locale === 'en') {
            return null;
        }

        return Cache::remember('translations_en', 3600, function () {
            $englishPath = lang_path('eng');
            $files = ['app', 'modules', 'messages', 'permissions', 'placeholders', 'pages'];
            $translations = [];

            foreach ($files as $file) {
                $filePath = $englishPath . '/' . $file . '.php';
                if (file_exists($filePath)) {
                    $translations[$file] = require $filePath;
                }
            }

            return $this->flattenTranslations($translations);
        });
    }

    /**
     * Flatten nested translation arrays for i18next
     */
    private function flattenTranslations(array $translations, string $prefix = ''): array
    {
        $flat = [];

        foreach ($translations as $key => $value) {
            $newKey = $prefix ? "{$prefix}.{$key}" : $key;

            if (is_array($value)) {
                $flat = array_merge($flat, $this->flattenTranslations($value, $newKey));
            } else {
                $flat[$newKey] = $value;
            }
        }

        return $flat;
    }

    /**
     * Get available locales for language switcher
     */
    private function getAvailableLocales(): array
    {
        return [
            'en' => ['name' => 'English', 'native' => 'English', 'dir' => 'ltr', 'flag' => 'gb'],
            'de' => ['name' => 'German', 'native' => 'Deutsch', 'dir' => 'ltr', 'flag' => 'de'],
            'ru' => ['name' => 'Russian', 'native' => 'Русский', 'dir' => 'ltr', 'flag' => 'ru'],
            'tr' => ['name' => 'Turkish', 'native' => 'Türkçe', 'dir' => 'ltr', 'flag' => 'tr'],
        ];
    }
}
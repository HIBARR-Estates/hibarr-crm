<?php

namespace App\Http\Middleware;

use App\Models\UserNotificationAlertSetting;
use App\Services\I18nTranslationService;
use App\Support\FeatureFlags;
use App\Support\UserTimezone;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * RTL locales for right-to-left text direction
     */
    // None of the four supported languages (en, de, ru, tr) are RTL
    protected array $rtlLocales = [];

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
    //     return env('APP_BUNDLER') === 'vite'
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
            // countries / currencies: page props or GET /account/api/form-data/{type} (Task B3)
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
            'company' => fn () => function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting() : null,
            'appName' => fn () => function_exists('companyOrGlobalSetting')
                ? (companyOrGlobalSetting()->app_name ?? config('app.name'))
                : config('app.name'),
            'appTheme' => fn () => function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting() : null,
            'notificationAlertSettings' => fn () => $request->user()
                ? Inertia::defer(fn () => UserNotificationAlertSetting::forUser((int) $request->user()->id))
                : null,
            // Permissions/modules live on auth.*; sidebar keeps only sidebar-specific extras.
            'sidebar' => [
                'unreadMessagesCount' => fn () => function_exists('user') && user() ? $this->getUnreadMessagesCount() : 0,
                'customLinks' => fn () => function_exists('user') ? $this->getCustomLinks() : [],
                'worksuitePlugins' => fn () => function_exists('user') ? $this->getWorksuitePlugins() : [],
            ],
            'currentRouteName' => $request->route() ? $request->route()->getName() : '',
            'pipelines' => fn () => $this->getPipelines(),

            // Internationalization props (dictionaries load via GET /account/api/i18n/{locale}.json)
            'locale' => fn () => $this->getCurrentLocale(),
            'isRtl' => fn () => $this->isRtlLocale(),
            'availableLocales' => fn () => app(I18nTranslationService::class)->getAvailableLocales(),
            'featureFlags' => fn () => FeatureFlags::forInertia(),
            'viewerTimezone' => fn () => UserTimezone::forViewer(
                $request->user(),
                function_exists('company') ? company() : null
            ),
            'integrationsHubUrl' => fn () => $this->getIntegrationsHubUrl(),
            'posthog' => fn () => $this->getPostHogConfig(),
            'pipelineCategoryScopeMap' => fn () => $this->getPipelineCategoryScopeMap($request),
            'pipelineFieldScopeMap' => fn () => $this->getPipelineFieldScopeMap($request),
            'stages' => fn () => $this->getPipelineStages($request),
        ]);
    }

    /**
     * Routes whose UI actually consumes pipeline scope data (deal show/edit/create
     * and the boards that embed the deal save modal). Kept narrow so the scope
     * resolver isn't queried on every Inertia response.
     */
    private function routeNeedsPipelineScopeData(Request $request): bool
    {
        $routeName = $request->route()?->getName();

        if (!$routeName) {
            return false;
        }

        return str_starts_with($routeName, 'deals.') || str_starts_with($routeName, 'leadboards.');
    }

    private function getPipelineCategoryScopeMap(Request $request): array
    {
        try {
            if (!$this->routeNeedsPipelineScopeData($request) || !function_exists('company') || !company()) {
                return [];
            }

            return app(\App\Services\PipelineScopeResolverService::class)
                ->buildCategoryScopeMapForCompany(company()->id);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to build pipeline category scope map for Inertia share', [
                'message' => $e->getMessage(),
            ]);

            return [];
        }
    }

    private function getPipelineFieldScopeMap(Request $request): array
    {
        try {
            if (!$this->routeNeedsPipelineScopeData($request) || !function_exists('company') || !company()) {
                return [];
            }

            return app(\App\Services\PipelineScopeResolverService::class)
                ->buildFieldScopeMapForCompany(company()->id);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to build pipeline field scope map for Inertia share', [
                'message' => $e->getMessage(),
            ]);

            return [];
        }
    }

    private function getPipelineStages(Request $request): array
    {
        try {
            if (!$this->routeNeedsPipelineScopeData($request) || !function_exists('company') || !company()) {
                return [];
            }

            return \App\Models\PipelineStage::query()
                ->select('id', 'name', 'priority', 'lead_pipeline_id', 'label_color')
                ->orderBy('priority')
                ->orderBy('id')
                ->get()
                ->toArray();
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to load pipeline stages for Inertia share', [
                'message' => $e->getMessage(),
            ]);

            return [];
        }
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

    private function getUnreadMessagesCount(): int
    {
        // Return unread messages count - implement based on your message system
        return 0; // Placeholder
    }

    /**
     * Client-side PostHog config, or null when no key is configured.
     *
     * Null rather than an empty key so the frontend has one thing to check —
     * an unconfigured environment does not load the library at all.
     *
     * Carries no user data itself — just the key and host. Identity is taken
     * from the `auth.user` prop that is already shared with every page, so
     * there is one definition of "who is logged in" rather than a second copy
     * that can drift out of step with it.
     *
     * What the frontend then sends about that user (currently name and email,
     * as staff PII to a third-party processor) is decided in
     * resources/js/lib/analytics.ts — see the note on personTraits().
     *
     * @return array{key: string, host: string}|null
     */
    private function getPostHogConfig(): ?array
    {
        $key = config('services.posthog.key');

        if (empty($key)) {
            return null;
        }

        return [
            'key' => $key,
            'host' => config('services.posthog.host'),
        ];
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

    /**
     * URL for the Hibarr Integrations Hub, environment-aware.
     */
    private function getIntegrationsHubUrl(): string
    {
        return app()->environment('production')
            ? 'https://integrations.hibarr.de'
            : 'https://integrations.staging.hibarr.de';
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

            $query = \App\Models\LeadPipeline::has('stages')
                ->select('id', 'name', 'default');
                

            if (FeatureFlags::enabled('crm.pipeline-nav-visibility')) {
                $query->visibleInNav();
            }

            return $query->get()->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }

    private function getAllPermissions()
    {
        if (!function_exists('user') || !user()) {
            return [];
        }

        // // Get all permissions for the user in a single query
        // // This joins user_permissions -> permissions -> permission_types
        // $userPermissions = \App\Models\UserPermission::join('permissions', 'user_permissions.permission_id', '=', 'permissions.id')
        //     ->join('permission_types', 'user_permissions.permission_type_id', '=', 'permission_types.id')
        //     ->where('user_permissions.user_id', user()->id)
        //     ->select('permissions.name as permission_name', 'permission_types.name as permission_type')
        //     ->pluck('permission_type', 'permission_name')
        //     ->toArray();

        // Byte-for-byte the query User::permissionMap() already runs and memoizes
        // for the request, so reuse it rather than paying for it twice on every
        // Inertia page. (permissionMap keeps the first row per permission where
        // this used to keep the last — user_permissions has no duplicate
        // (user_id, permission_id) pairs, so the two agree.)
        $userPermissions = user()->permissionMap();

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
            return user()->locale;
        }

        return session('locale', app()->getLocale());
    }

    /**
     * Check if current locale is RTL
     */
    private function isRtlLocale(): bool
    {
        return in_array($this->getCurrentLocale(), $this->rtlLocales);
    }
}

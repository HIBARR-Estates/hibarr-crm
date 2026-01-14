<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     */
    //protected $rootView = 'layouts.inertia_vite';
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
                'user' => auth()->user() ? auth()->user()->load(['roles', 'employeeDetail.designation']) : null,
                'permissions' => function_exists('user') ? $this->getAllPermissions() : [],
                'modules' => function_exists('user_modules') ? user_modules() : [],
            ],
            'default_currency_symbol' => fn () => $this->getDefaultCurrencySymbol(),
            'default_currency_code' => fn () => $this->getDefaultCurrencyCode(),
            'currencies' => fn () => $this->getCompanyCurrencies(),
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

            return $company?->currencies ?? [];
        } catch (\Exception $e) {
            return [];
        }
    }

  

    private function getUnreadMessagesCount(): int
    {
        // Return unread messages count - implement based on your message system
        return 0; // Placeholder
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
}
<?php

namespace App\Http\Controllers;

use App\Support\ExpiringCacheRegistry;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Settings → Cache refresh: lets an admin clear the expiring data caches
 * (filter option lists, translations, ...) instead of waiting out their TTL.
 * What may be cleared is fixed in ExpiringCacheRegistry.
 */
class CacheRefreshController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(! in_array('admin', user_roles()));

            return $next($request);
        });
    }

    public function index()
    {
        $groups = [];
        foreach (ExpiringCacheRegistry::groups((int) company()->id) as $name => $group) {
            $groups[] = ['key' => $name, 'ttl_seconds' => $group['ttl_seconds']];
        }

        return Inertia::render('Settings/CacheRefresh', [
            'pageTitle' => __('pages.cache_refresh.title'),
            'groups' => $groups,
        ]);
    }

    public function clear(Request $request)
    {
        $companyId = (int) company()->id;

        $validated = $request->validate([
            'groups' => ['sometimes', 'array'],
            'groups.*' => ['string', Rule::in(array_keys(ExpiringCacheRegistry::groups($companyId)))],
        ]);

        return response()->json([
            'status' => 'success',
            'cleared' => ExpiringCacheRegistry::clear($companyId, $validated['groups'] ?? null),
        ]);
    }
}

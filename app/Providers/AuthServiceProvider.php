<?php

namespace App\Providers;

use App\Models\Property;
use App\Models\PropertyAvailabilityRequest;
use App\Policies\PropertyPolicy;
use App\Policies\PropertyAvailabilityRequestPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{

    /**
     * The policy mappings for the application.
     *
     * @var array
     */
    protected $policies = [
        Property::class => PropertyPolicy::class,
        PropertyAvailabilityRequest::class => PropertyAvailabilityRequestPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     *
     * @return void
     */
    public function boot()
    {
        $this->registerPolicies();
    }

}

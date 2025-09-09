<?php

namespace Modules\UniversalBundle\Providers;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;

class UniversalBundleServiceProvider extends ServiceProvider
{

    /**
     * Indicates if loading of the provider is deferred.
     *
     * @var bool
     */
    protected $defer = false;

    /**
     * Boot the application events.
     *
     * @return void
     */
    public function boot()
    {
        $this->registerTranslations();
        $this->registerConfig();
        $this->registerViews();
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
        Blade::componentNamespace('Modules\\UniversalBundle\\Views\\Components', 'universalbundle');
    }

    /**
     * Register the service provider.
     *
     * @return void
     */
    public function register()
    {
        $this->app->register(RouteServiceProvider::class);
    }

    /**
     * Register config.
     *
     * @return void
     */
    protected function registerConfig()
    {
        $this->publishes([
            __DIR__.'/../Config/config.php' => config_path('universalbundle.php'),
        ]);

        $this->mergeConfigFrom(
            __DIR__.'/../Config/config.php', 'universalbundle'
        );

        $this->mergeConfigFrom(
            module_path('universalbundle', 'Config/xss_ignore.php'),
            'universalbundle::xss_ignore'
        );
    }

    /**
     * Register views.
     *
     * @return void
     */
    public function registerViews()
    {
        $viewPath = base_path('resources/views/modules/universalbundle');

        $sourcePath = __DIR__.'/../Resources/views';

        $this->publishes([
            $sourcePath => $viewPath
        ]);

        $this->loadViewsFrom(array_merge(array_map(function ($path) {
            return $path . '/modules/universalbundle';
        }, \Config::get('view.paths')), [$sourcePath]), 'universalbundle');
    }

    /**
     * Register translations.
     *
     * @return void
     */
    public function registerTranslations()
    {
        $langPath = base_path('resources/lang/modules/universalbundle');

        if (is_dir($langPath)) {
            $this->loadTranslationsFrom($langPath, 'universalbundle');
        }
        else {
            $this->loadTranslationsFrom(__DIR__ .'/../Resources/lang', 'universalbundle');
        }
    }

    /**
     * Get the services provided by the provider.
     *
     * @return array
     */
    public function provides()
    {
        return array();
    }

}

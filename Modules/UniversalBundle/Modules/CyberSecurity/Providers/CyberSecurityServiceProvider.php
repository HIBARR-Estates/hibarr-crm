<?php

namespace Modules\CyberSecurity\Providers;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class CyberSecurityServiceProvider extends ServiceProvider
{

    /**
     * @var string $moduleName
     */
    protected $moduleName = 'CyberSecurity';

    /**
     * @var string $moduleNameLower
     */
    protected $moduleNameLower = 'cybersecurity';

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
        $this->loadMigrationsFrom(module_path($this->moduleName, 'Database/Migrations'));
        $this->registerCommands();
        $this->registerMiddleware();
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
            module_path($this->moduleName, 'Config/config.php') => config_path($this->moduleNameLower . '.php'),
        ], 'config');
        $this->mergeConfigFrom(
            module_path($this->moduleName, 'Config/config.php'), $this->moduleNameLower
        );

        $this->mergeConfigFrom(
            module_path($this->moduleNameLower, 'Config/xss_ignore.php'),
            $this->moduleNameLower . '::xss_ignore'
        );
    }

    /**
     * Register views.
     *
     * @return void
     */
    public function registerViews()
    {
        $viewPath = resource_path('views/modules/' . $this->moduleNameLower);

        $sourcePath = module_path($this->moduleName, 'Resources/views');

        $this->publishes([
            $sourcePath => $viewPath
        ], ['views', $this->moduleNameLower . '-module-views']);

        $this->loadViewsFrom(array_merge($this->getPublishableViewPaths(), [$sourcePath]), $this->moduleNameLower);
    }

    /**
     * Register translations.
     *
     * @return void
     */
    public function registerTranslations()
    {
        $langPath = resource_path('lang/modules/' . $this->moduleNameLower);

        if (is_dir($langPath)) {
            $this->loadTranslationsFrom($langPath, $this->moduleNameLower);
            $this->loadJsonTranslationsFrom($langPath, $this->moduleNameLower);
        }
        else {
            $this->loadTranslationsFrom(module_path($this->moduleName, 'Resources/lang'), $this->moduleNameLower);
            $this->loadJsonTranslationsFrom(module_path($this->moduleName, 'Resources/lang'), $this->moduleNameLower);
        }
    }

    /**
     * Get the services provided by the provider.
     *
     * @return array
     */
    public function provides()
    {
        return [];
    }

    private function getPublishableViewPaths(): array
    {
        $paths = [];

        foreach (Config::get('view.paths') as $path) {
            if (is_dir($path . '/modules/' . $this->moduleNameLower)) {
                $paths[] = $path . '/modules/' . $this->moduleNameLower;
            }
        }

        return $paths;
    }

    /**
     * Register artisan commands
     */
    private function registerCommands()
    {
        $this->commands(
            [
            ]
        );
    }

    /**
     * Register middleware
     */
    private function registerMiddleware()
    {
        try {
            if (Schema::hasTable('cyber_security_settings')) {
                $router = $this->app['router'];

                $router->pushMiddlewareToGroup('web', \Modules\CyberSecurity\Http\Middleware\CyberSecurityMiddleware::class);
                $router->pushMiddlewareToGroup('web', \Modules\CyberSecurity\Http\Middleware\BlackListIpMiddleware::class);
                $router->pushMiddlewareToGroup('web', \Modules\CyberSecurity\Http\Middleware\BlackListEmailMiddleware::class);
                $router->pushMiddlewareToGroup('web', \Modules\CyberSecurity\Http\Middleware\LoginExpiryMiddleware::class);
            }
        }catch (\Exception $exception){

        }

    }

}

<?php

namespace Modules\RestAPI\Providers;

use App\Events\LeaveEvent;
use App\Events\NewCompanyCreatedEvent;
use App\Events\NewExpenseEvent;
use App\Events\NewNoticeEvent;
use App\Events\NewProjectMemberEvent;
use App\Events\ProjectReminderEvent;
use App\Events\TaskEvent;
use App\Events\TaskReminderEvent;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;
use Modules\RestAPI\Console\ActivateModuleCommand;
use Modules\RestAPI\Entities\PersonalAccessToken;
use Modules\RestAPI\Http\Middleware\AuthMiddleware;
use Modules\RestAPI\Listeners\CompanyCreatedListener;
use Modules\RestAPI\Listeners\ExpensePushListener;
use Modules\RestAPI\Listeners\LeavePushListener;
use Modules\RestAPI\Listeners\NewNoticePushListener;
use Modules\RestAPI\Listeners\ProjectMemberPushListener;
use Modules\RestAPI\Listeners\ProjectReminderPushListener;
use Modules\RestAPI\Listeners\TaskPushListener;
use Modules\RestAPI\Listeners\TaskReminderPushListener;

class RestAPIServiceProvider extends ServiceProvider
{
    /**
     * Boot the application events.
     *
     * @return void
     */
    public function boot(Router $router)
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // Set your app config.
        $this->registerTranslations();
        $this->registerConfig();
        $this->registerViews();
        $this->loadMigrationsFrom(module_path('RestAPI', 'Database/Migrations'));

        $router->aliasMiddleware('api.auth', AuthMiddleware::class);
        $this->commands([
            ActivateModuleCommand::class,
        ]);

        Event::listen(TaskReminderEvent::class, TaskReminderPushListener::class);
        Event::listen(TaskEvent::class, TaskPushListener::class);
        Event::listen(NewProjectMemberEvent::class, ProjectMemberPushListener::class);
        Event::listen(ProjectReminderEvent::class, ProjectReminderPushListener::class);
        Event::listen(NewNoticeEvent::class, NewNoticePushListener::class);
        Event::listen(NewExpenseEvent::class, ExpensePushListener::class);
        Event::listen(LeaveEvent::class, LeavePushListener::class);
        Event::listen(NewCompanyCreatedEvent::class, CompanyCreatedListener::class);
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
            __DIR__.'/../Config/config.php' => config_path('restapi.php'),
        ], 'config');
        $this->mergeConfigFrom(__DIR__.'/../Config/config.php', 'restapi');

        $this->mergeConfigFrom(
            module_path('restapi', 'Config/xss_ignore.php'),
            'restapi::xss_ignore'
        );
    }

    /**
     * Register views.
     *
     * @return void
     */
    public function registerViews()
    {
        $viewPath = resource_path('views/modules/restapi');

        $sourcePath = __DIR__.'/../Resources/views';

        $this->publishes([
            $sourcePath => $viewPath,
        ], 'views');

        $this->loadViewsFrom([$sourcePath], 'restapi');

    }

    /**
     * Register translations.
     *
     * @return void
     */
    public function registerTranslations()
    {
        $langPath = resource_path('lang/modules/restapi');

        if (is_dir($langPath)) {
            $this->loadTranslationsFrom($langPath, 'restapi');

        } else {
            $this->loadTranslationsFrom(__DIR__.'/../Resources/lang', 'restapi');
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
}

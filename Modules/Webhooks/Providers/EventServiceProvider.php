<?php

namespace Modules\Webhooks\Providers;

use App\Events\NewCompanyCreatedEvent;
use App\Models\ClientDetails;
use App\Models\EmployeeDetails;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Project;
use App\Models\Proposal;
use App\Models\Task;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Modules\Webhooks\Listeners\CompanyCreatedListener;
use Modules\Webhooks\Observers\ClientDetailsObserver;
use Modules\Webhooks\Observers\EmployeeDetailsObserver;
use Modules\Webhooks\Observers\InvoiceObserver;
use Modules\Webhooks\Observers\LeadObserver;
use Modules\Webhooks\Observers\ProjectObserver;
use Modules\Webhooks\Observers\ProposalObserver;
use Modules\Webhooks\Observers\TaskObserver;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        NewCompanyCreatedEvent::class => [CompanyCreatedListener::class],
    ];

    protected $observers = [
        ClientDetails::class => [ClientDetailsObserver::class],
        EmployeeDetails::class => [EmployeeDetailsObserver::class],
        Invoice::class => [InvoiceObserver::class],
        Lead::class => [LeadObserver::class],
        Project::class => [ProjectObserver::class],
        Proposal::class => [ProposalObserver::class],
        Task::class => [TaskObserver::class],
    ];
}

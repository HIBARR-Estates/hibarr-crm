<?php

namespace Modules\Webhooks\Observers;

use App\Models\Project;
use Modules\Webhooks\Jobs\SendWebhook;

class ProjectObserver
{

    public function created(Project $project)
    {
        SendWebhook::dispatch($project->toArray(), 'Project', $project->company_id)
            ->delay(5)
            ->onQueue('default');
    }

}

<?php

namespace Modules\Webhooks\Observers;

use App\Models\Task;
use Modules\Webhooks\Jobs\SendWebhook;

class TaskObserver
{

    public function created(Task $task)
    {
        SendWebhook::dispatch($task->toArray(), 'Task', $task->company_id)
            ->delay(5)
            ->onQueue('default');
    }

}

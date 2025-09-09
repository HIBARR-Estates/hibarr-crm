<?php

namespace Modules\Performance\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Performance\Entities\Meeting;
use Modules\Performance\Entities\Objective;

class CheckInReminderEvent
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $objective;
    public $owners;
    public $keyResult;

    /**
     * Create a new event instance.
     *
     * @param Objective $objective
     * @param mixed $owners
     * @param mixed $keyResult
     */
    public function __construct(Objective $objective, $owners, $keyResult = null)
    {
        $this->objective = $objective;
        $this->owners = $owners;
        $this->keyResult = $keyResult;
    }

}


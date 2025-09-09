<?php

namespace Modules\Performance\Events;

use Illuminate\Queue\SerializesModels;
use Modules\Performance\Entities\Objective;

class ObjectiveCreatedEvent
{

    use SerializesModels;

    public $objective;
    public $owners;

    /**
     * Create a new event instance.
     */
    public function __construct(Objective $objective, $users)
    {
        $this->objective = $objective;
        $this->owners = $users;
    }

}

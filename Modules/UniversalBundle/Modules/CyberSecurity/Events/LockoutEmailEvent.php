<?php

namespace Modules\CyberSecurity\Events;

use Illuminate\Queue\SerializesModels;

class LockoutEmailEvent
{
    use SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(public $email, public $ip)
    {
        //
    }

}

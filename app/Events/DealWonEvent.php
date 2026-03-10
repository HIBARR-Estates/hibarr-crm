<?php

namespace App\Events;

use App\Models\Deal;
use App\Models\LeadAgent;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DealWonEvent
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Deal $deal;
    public LeadAgent $agent;

    public function __construct(Deal $deal, LeadAgent $agent)
    {
        $this->deal = $deal;
        $this->agent = $agent;
    }
}

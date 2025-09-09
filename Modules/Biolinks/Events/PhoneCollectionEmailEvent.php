<?php

namespace Modules\Biolinks\Events;

use Illuminate\Queue\SerializesModels;
use Modules\Biolinks\Entities\BiolinkBlocks;

class PhoneCollectionEmailEvent
{

    use SerializesModels;

    public $biolinkBlock;
    public $name;
    public $phone;

    /**
     * Create a new event instance.
     */
    public function __construct(BiolinkBlocks $biolinkBlock, $name, $phone)
    {
        $this->biolinkBlock = $biolinkBlock;
        $this->name = $name;
        $this->phone = $phone;
    }

}

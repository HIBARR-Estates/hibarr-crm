<?php

namespace Modules\Letter\Observers;

use Modules\Letter\Entities\Letter;

class LetterObserver
{

    public function creating(Letter $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }

}

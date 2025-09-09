<?php

namespace Modules\Zoom\Observers;

use Modules\Zoom\Entities\ZoomCategory;

class CategoryObserver
{
    public function creating(ZoomCategory $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}

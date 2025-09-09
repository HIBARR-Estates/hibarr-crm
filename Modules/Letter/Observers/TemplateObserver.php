<?php

namespace Modules\Letter\Observers;

use Modules\Letter\Entities\Template;

class TemplateObserver
{

    public function creating(Template $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }

}

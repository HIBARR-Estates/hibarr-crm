<?php

namespace Modules\UniversalBundle\Entities;

use App\Models\BaseModel;

class UniversalBundleSetting extends BaseModel
{
    protected $guarded = ['id'];

    const MODULE_NAME = 'universalbundle';
}


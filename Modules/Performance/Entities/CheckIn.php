<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Models\User;
use App\Traits\HasCompany;

class CheckIn extends BaseModel
{
    use HasCompany;

    public function keyResult()
    {
        return $this->belongsTo(KeyResults::class, 'key_result_id');
    }

    public function checkInBy()
    {
        return $this->belongsTo(User::class, 'check_in_by');
    }

}

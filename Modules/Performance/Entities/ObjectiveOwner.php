<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Models\User;

class ObjectiveOwner extends BaseModel
{

    protected $table = 'objective_owners';
    public $timestamps = false;

    public function objective()
    {
        return $this->belongsTo(Objective::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

}

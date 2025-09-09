<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;

class ObjectiveProgressStatus extends BaseModel
{

    public $timestamps = false;

    public function objective()
    {
        return $this->belongsTo(Objective::class, 'objective_id');
    }

    public function update(array $attributes = [], array $options = [])
    {
        $this->timestamps = false;
        $result = parent::update($attributes, $options);
        $this->timestamps = true;
        return $result;
    }

}

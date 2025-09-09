<?php

namespace Modules\Biolinks\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\Biolinks\Database\factories\BiolinkFactory;
use Modules\Biolinks\Enums\Status;

class Biolink extends BaseModel
{

    use HasCompany, HasFactory;

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'status' => Status::class,
    ];

    public function biolinkSettings(): HasOne
    {
        return $this->hasOne(BiolinkSetting::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Create a new factory instance for the model.
     *
     * @return \Illuminate\Database\Eloquent\Factories\Factory
     */
    protected static function newFactory()
    {
        return BiolinkFactory::new();
    }

}

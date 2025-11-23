<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DealPropertyService extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'company_id',
        'value',
        'category',
    ];

    public function deals()
    {
        return $this->belongsToMany(Deal::class, 'deal_service');
    }
}

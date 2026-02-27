<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Property Area lookup model.
 *
 * Each area belongs to a city (PropertyCity) and a company.
 *
 * @property int         $id
 * @property int         $company_id
 * @property int         $city_id
 * @property string      $name
 * @property string      $label
 * @property string|null $description
 */
class PropertyArea extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_areas';

    protected $fillable = [
        'company_id',
        'city_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];

    /**
     * The city this area belongs to.
     */
    public function city(): BelongsTo
    {
        return $this->belongsTo(PropertyCity::class, 'city_id');
    }
}

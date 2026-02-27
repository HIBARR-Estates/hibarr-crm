<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Location Feature lookup model.
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name
 * @property string      $label
 * @property string|null $description
 */
class PropertyLocationFeature extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_location_features';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}

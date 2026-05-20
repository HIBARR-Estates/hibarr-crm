<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property City lookup model.
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name
 * @property string      $label
 * @property string|null $description
 */
class PropertyCity extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_cities';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
        'default_distances',
        'image_url',
    ];

    protected $casts = [
        'default_distances' => 'array',
    ];

    protected $hidden = ['pivot'];
}

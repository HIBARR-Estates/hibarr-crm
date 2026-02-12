<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Interior Feature lookup model.
 *
 * Stores user-manageable interior features (Air Condition, Fireplace, etc.)
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name         Unique per company
 * @property string      $label        Human-readable display label
 * @property string|null $description
 */
class PropertyInteriorFeature extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_interior_features';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}

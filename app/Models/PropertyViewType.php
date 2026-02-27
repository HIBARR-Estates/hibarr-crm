<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property View Type lookup model.
 *
 * Stores user-manageable view types (Sea Front, Mountain View, etc.)
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name         Unique per company
 * @property string      $label        Human-readable display label
 * @property string|null $description
 */
class PropertyViewType extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_view_types';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}

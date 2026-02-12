<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Title Deed Type lookup model.
 *
 * Stores user-manageable title deed types (Turkish/British, Exchange, TRNC Allocation, etc.)
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name         Unique per company
 * @property string      $label        Human-readable display label
 * @property string|null $description
 */
class PropertyTitleDeedType extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_title_deed_types';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}

<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Deed Status lookup model.
 *
 * Stores user-manageable deed statuses:
 *   - Deed in Owner's Name (Individual)
 *   - Deed in Owner's Name (Shared)
 *   - Deed in Developer's Name (Ready)
 *   - No Deed (Sales Agreement Only)
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name         Unique per company
 * @property string      $label        Human-readable display label
 * @property string|null $description
 */
class PropertyDeedStatus extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_deed_statuses';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}

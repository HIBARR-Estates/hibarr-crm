<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Project Facility lookup model.
 *
 * Stores user-manageable project facilities (Gym, Pool, etc.)
 * that were previously hardcoded as constants on DeveloperProject.
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name        Unique per company, slug stored in developer_projects.facilities JSON
 * @property string      $label       Human-readable display label
 * @property string|null $description
 * @property string|null $icon        Lucide icon identifier (e.g. "waves", "dumbbell")
 * @property string|null $image_url   Default facility image URL used in expose fallback
 */
class ProjectFacility extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'project_facilities';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
        'icon',
        'image_url',
    ];
}

<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Airport Model
 * 
 * Represents predefined airport options that can be selected
 * when configuring project locations. These are global (not company-scoped)
 * as airports are fixed geographical entities.
 */
class Airport extends BaseModel
{
    use HasFactory, HasCompany;

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
        'image_url',
        'code',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get default airport items for seeding.
     * These are placeholder names for now.
     * 
     * @return array
     */
    public static function getDefaultItems(): array
    {
        return [
            ['name' => 'ercan_international', 'label' => 'Ercan International', 'code' => 'ECN'],
            ['name' => 'larnaca_international', 'label' => 'Larnaca International', 'code' => 'LCA'],
            ['name' => 'paphos_international', 'label' => 'Paphos International', 'code' => 'PFO'],
         
        ];
    }
}

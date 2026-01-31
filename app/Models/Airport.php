<?php

namespace App\Models;

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
    use HasFactory;

    protected $fillable = [
        'name',
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
            ['name' => 'Ercan', 'code' => 'ECN'],
            ['name' => 'Lanarca', 'code' => 'LCA'],
            ['name' => 'Paphos', 'code' => 'PFO'],
         
        ];
    }
}

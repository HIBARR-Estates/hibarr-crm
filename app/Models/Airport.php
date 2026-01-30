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
            ['name' => 'Airport 1', 'code' => 'APT1'],
            ['name' => 'Airport 2', 'code' => 'APT2'],
            ['name' => 'Airport 3', 'code' => 'APT3'],
            ['name' => 'Airport 4', 'code' => 'APT4'],
        ];
    }
}

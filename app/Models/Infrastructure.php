<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Infrastructure Model
 * 
 * Represents predefined infrastructure options (schools, hospitals, shopping centers, etc.)
 * that can be selected when configuring project locations.
 * Company-scoped to allow customization per tenant.
 */
class Infrastructure extends BaseModel
{
    use HasFactory, HasCompany;

    protected $fillable = [
        'company_id',
        'name',
        'icon',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get default infrastructure items for seeding.
     * 
     * @return array
     */
    public static function getDefaultItems(): array
    {
        return [
            ['name' => 'School', 'icon' => 'school'],
            ['name' => 'Hospital', 'icon' => 'hospital'],
            ['name' => 'Shopping Mall', 'icon' => 'shopping-cart'],
            ['name' => 'Supermarket', 'icon' => 'store'],
            ['name' => 'Beach', 'icon' => 'umbrella-beach'],
            ['name' => 'Bus Station', 'icon' => 'bus'],
            ['name' => 'Train Station', 'icon' => 'train'],
            ['name' => 'Pharmacy', 'icon' => 'pills'],
            ['name' => 'Bank', 'icon' => 'bank'],
            ['name' => 'Restaurant', 'icon' => 'utensils'],
            ['name' => 'Park', 'icon' => 'tree'],
            ['name' => 'Gym', 'icon' => 'dumbbell'],
            ['name' => 'Golf Course', 'icon' => 'golf-ball'],
            ['name' => 'Marina', 'icon' => 'anchor'],
            ['name' => 'Cinema', 'icon' => 'film'],
        ];
    }
}

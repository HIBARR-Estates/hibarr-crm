<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomFieldCategory extends Model
{
    protected $fillable = ['name', 'custom_field_group_id'];

    public function group()
    {
        return $this->belongsTo(CustomFieldGroup::class, 'custom_field_group_id');
    }

    public function customFields()
    {
        return $this->hasMany(CustomField::class);
    }
    use HasFactory;
}
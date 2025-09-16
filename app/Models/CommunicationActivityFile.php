<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
/**
 * App\Models\CommunicationActivityFile
 *
 * @property int $id
 * @property int $activity_id
 * @property string $file_url
 * @property string $file_type
 * @property int $file_size
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunicationActivity $activity
 */

class CommunicationActivityFile extends Model
{
    use HasFactory;

    protected $fillable = [
        'activity_id',
        'file_url',
        'file_type',
        'file_size',
    ];


    // communication activity the file belongs to
    public function activity(): BelongsTo
    {
        return $this->belongsTo(CommunicationActivity::class, 'activity_id');   
    }
}

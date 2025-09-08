<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Enums\CommissionStatus;

class Commission extends Model
{
    use HasFactory;

    protected $table = 'commissions';
    protected $casts = [
       'status' => CommissionStatus::class,
       'amount' => 'decimal:2',
       'level'  => 'integer',
    ];

    protected $fillable = [
        'employee_id',
        'event_type',
        'source_event_id',
        'amount',
        'level',
        'rule_version',
        'status',
    ];

    /**
     * The employee who earned the commission.
     */
    public function employee()
    {
        return $this->belongsTo(EmployeeDetails::class, 'employee_id');
    }
}
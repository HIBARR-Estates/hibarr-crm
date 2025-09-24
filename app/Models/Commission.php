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
    ];

    protected $attributes = [
        'status' => CommissionStatus::Pending->value,
    ];

    // Methods for status transitions for Commission
     /**
      * Approve the commission if it's currently pending.
      *
      * @throws \DomainException if the commission is not in a pending state.
      */
    public function approve()
    {
         $updated = static::query()
        ->whereKey($this->getKey())
        ->where('status', CommissionStatus::Pending->value)
        ->update(['status' => CommissionStatus::Approved->value]);
        if ($updated !== 1) {
            throw new \DomainException('Only pending commissions can be approved.');
        }
        $this->refresh();
    }

    /**
     * Mark the commission as paid if it's currently approved.
     *
     * @throws \DomainException if the commission is not in an approved state.
     */
    public function markPaid()
    {
        $updated = static::query()
        ->whereKey($this->getKey())
        ->where('status', CommissionStatus::Approved->value)
        ->update(['status' => CommissionStatus::Paid->value]);
       if ($updated !== 1) {
           throw new \DomainException('Only approved commissions can be marked as paid.');
       }
       $this->refresh();
    }
    /**
     * Cancel the commission unless it's already paid.
     *
     * @throws \DomainException if the commission is already paid.
     */

    public function cancel()
    {
        $updated = static::query()
            ->whereKey($this->getKey())
            ->whereIn('status', [CommissionStatus::Pending->value, CommissionStatus::Approved->value])
            ->update(['status' => CommissionStatus::Cancelled->value]);
        if ($updated !== 1) {
            throw new \DomainException('Only pending or approved commissions can be cancelled.');
        }
        $this->refresh();
    }

    /**
     * The employee who earned the commission.
     */
    public function employee()
    {
        return $this->belongsTo(EmployeeDetails::class, 'employee_id');
    }
}
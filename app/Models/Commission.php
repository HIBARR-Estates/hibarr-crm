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

    // Methods for status transitions for Commission
     /**
      * Approve the commission if it's currently pending.
      *
      * @throws \DomainException if the commission is not in a pending state.
      */
    public function approve()
    {
        if ($this->status !== CommissionStatus::Pending) {
            throw new \DomainException('Only pending commissions can be approved.');
        }
        $this->status = CommissionStatus::Approved;
        $this->save();
    }

    /**
     * Mark the commission as paid if it's currently approved.
     *
     * @throws \DomainException if the commission is not in an approved state.
     */
    public function markPaid()
    {
        if ($this->status !== CommissionStatus::Approved) {
            throw new \DomainException('Only approved commissions can be marked as paid.');
        }
        $this->status = CommissionStatus::Paid;
        $this->save();
    }
    /**
     * Cancel the commission unless it's already paid.
     *
     * @throws \DomainException if the commission is already paid.
     */

    public function cancel()
    {
        if ($this->status === CommissionStatus::Paid) {
            throw new \DomainException('Paid commissions cannot be cancelled.');
        }
        $this->status = CommissionStatus::Cancelled;
        $this->save();
    }

    /**
     * The employee who earned the commission.
     */
    public function employee()
    {
        return $this->belongsTo(EmployeeDetails::class, 'employee_id');
    }
}
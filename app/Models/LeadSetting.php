<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class LeadSetting extends BaseModel
{
    use HasCompany, HasFactory;

    protected $table = 'lead_setting';

    /**
     * Persist the first-contact SLA for the current company.
     *
     * Assigned rather than mass-filled: this model declares no $fillable, so
     * it is totally guarded and fill() would throw.
     */
    public static function persistFirstContactSlaSeconds(int $seconds, int $userId): self
    {
        $companyId = company()->id;
        $row = static::where('company_id', $companyId)->first();

        if (! $row) {
            $row = new static;
            $row->company_id = $companyId;
            $row->user_id = $userId;
        }

        $row->first_contact_sla_seconds = $seconds;
        $row->save();

        return $row;
    }
}

<?php

namespace Modules\RestAPI\Entities;

use App\Models\User;
use App\Observers\InvoiceObserver;
use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends \App\Models\Invoice
{
    // region Properties

    protected $table = 'invoices';

    protected $default = [
        'id',
        'invoice_number',
        'total',
        'status',
        'issue_date',
        'company_id',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'status',
        'invoice_number',
    ];

    protected $hidden = [
        'updated_at',
    ];

    protected $appends = ['original_invoice_number'];

    public static function boot()
    {
        parent::boot();
        static::observe(InvoiceObserver::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id')->withTrashed();
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id')->withoutGlobalScope(ActiveScope::class);
    }

    public function clientdetails(): BelongsTo
    {
        return $this->belongsTo(ClientDetails::class, 'client_id', 'user_id');
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'currency_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItems::class, 'invoice_id');
    }

    public function visibleTo(User $user)
    {
        if ($user->hasRole('admin') || ($user->hasRole('employee') || $user->cans('view_invoices'))) {
            return true;
        }

        return $this->client_id == $user->id;
    }

    public function scopeVisibility($query)
    {
        if (api_user()) {
            $user = api_user();

            if ($user->hasRole('admin')) {
                return $query;
            }

            // If employee or client show projects assigned
            $query->leftJoin('projects', 'invoices.project_id', '=', 'projects.id')
                ->join('project_members', 'project_members.project_id', '=', 'projects.id')
                ->where(function ($query) use ($user) {
                    $query->where('project_members.user_id', $user->id)
                        ->orWhere('invoices.client_id', $user->id);
                });

            return $query;

        }

        return $query;
    }

    public function getOriginalInvoiceNumberAttribute()
    {
        $invoiceSettings = (company()) ? company()->invoiceSetting : $this->company->invoiceSetting;
        $zero = '';

        if (strlen($this->invoice_number) < $invoiceSettings->invoice_digit) {
            $condition = $invoiceSettings->invoice_digit - strlen($this->invoice_number);

            for ($i = 0; $i < $condition; $i++) {
                $zero = '0'.$zero;
            }
        }

        return $zero.$this->invoice_number;
    }
}

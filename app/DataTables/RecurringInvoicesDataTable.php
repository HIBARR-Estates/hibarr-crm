<?php

namespace App\DataTables;

use App\Models\GlobalSetting;
use App\Models\Invoice;
use App\Models\InvoiceSetting;
use Illuminate\Support\Facades\DB;
use Yajra\DataTables\EloquentDataTable;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;
use App\Helper\UserService;
use App\Helper\Common;

class RecurringInvoicesDataTable extends BaseDataTable
{

    protected $firstInvoice;
    protected $invoiceSettings;
    private $editInvoicePermission;
    private $deleteInvoicePermission;
    private $viewInvoicePermission;

    public function __construct($ignoreInvoicesWithTrashed = false)
    {
        parent::__construct();
        $this->viewInvoicePermission = user()->permission('view_invoices');
        $this->editInvoicePermission = user()->permission('edit_invoices');
        $this->deleteInvoicePermission = user()->permission('delete_invoices');
    }

    public function dataTable($query)
    {
        $firstInvoice = $this->firstInvoice;
        $invoiceSettings = $this->invoiceSettings;
        $userId = UserService::getUserId();

        return (new EloquentDataTable($query))
            ->addIndexColumn()
            ->filterColumn('invoice_number', function ($query, $keyword) use ($invoiceSettings) {
                $string = ltrim(str_replace($invoiceSettings->invoice_prefix . $invoiceSettings->invoice_number_separator, '', $keyword), '0');
                $sql = 'invoices.invoice_number  like ?';
                $query->whereRaw($sql, ['%{$string}%']);
            })
            ->addColumn('action', function ($row) use ($firstInvoice, $userId) {

                $action = '<div class="task_view">

                <div class="dropdown">
                    <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                        id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <i class="icon-options-vertical icons"></i>
                    </a>
                    <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';

                $action .= '<a href="' . route('invoices.show', [$row->id]) . '" class="dropdown-item"><i class="fa fa-eye mr-2"></i>' . __('app.view') . '</a>';

                if ($this->viewInvoicePermission == 'all' || ($this->viewInvoicePermission == 'added' && (user()->id == $row->added_by || $userId == $row->added_by))) {
                    $action .= '<a class="dropdown-item" href="' . route('invoices.download', [$row->id]) . '">
                                    <i class="fa fa-download mr-2"></i>
                                    ' . trans('app.download') . '
                                </a>';
                }

                if ($row->status != 'canceled' && $row->credit_note == 0 && !in_array('client', user_roles())) {
                    $action .= '<a class="dropdown-item sendButton" href="javascript:;" data-toggle="tooltip"  data-invoice-id="' . $row->id . '">
                                    <i class="fa fa-paper-plane mr-2"></i>
                                    ' . trans('app.send') . '
                                </a>';
                }

                $edit = (!is_null($row->project) && is_null($row->project->deleted_at)) ? '<a class="dropdown-item" href="' . route('invoices.edit', $row->id) . '" >
                        <i class="fa fa-edit mr-2"></i>
                        ' . trans('app.edit') . '
                    </a>' : ((is_null($row->project_id)) ? '<a class="dropdown-item" href="' . route('invoices.edit', $row->id) . '" >
                        <i class="fa fa-edit mr-2"></i>
                        ' . trans('app.edit') . '
                    </a>' : '');

                if ($row->status == 'paid' && $row->credit_note == 0 && !in_array('client', user_roles())) {
                    $action .= '<a class="dropdown-item invoice-upload" href="javascript:;" data-toggle="tooltip"  data-invoice-id="' . $row->id . '"><i class="fa fa-upload mr-2"></i>
                                    ' . trans('app.upload') . '
                                </a>';

                    if ($row->amountPaid() == 0 && $row->amountDue() > 0) {
                        $action .= $edit;
                    }
                }

                if ($row->status != 'paid' && $row->status != 'canceled') {
                    if ($row->status != 'pending-confirmation') {
                        if (
                            $this->editInvoicePermission == 'all'
                            || ($this->editInvoicePermission == 'added' && ($row->added_by == $userId || $row->added_by == user()->id))
                            || ($this->editInvoicePermission == 'owned' && $row->client_id == $userId)
                            || ($this->editInvoicePermission == 'both' && ($row->client_id == $userId || $row->added_by == $userId || $row->added_by == user()->id))
                        ) {
                            $action .= $edit;
                        }
                    }
                }

                if ($row->status != 'paid' && $row->status != 'canceled' && in_array('payments', $this->user->modules) && !in_array('client', user_roles()) && $row->credit_note == 0 && $row->status != 'draft') {
                    $action .= '<a class="dropdown-item openRightModal" href="' . route('payments.create') . '?invoice_id=' . $row->id . '" >
                                    <i class="fa fa-plus mr-2"></i>
                                    ' . trans('modules.payments.addPayment') . '
                                </a>';
                }

                /* Starts here */

                if ($row->status != 'canceled' && isset($row->client) && isset($row->client->clientDetails) && !is_null($row->client->clientDetails->shipping_address)) {
                    if (isset($row->show_shipping_address) && $row->show_shipping_address === 'yes') {
                        /** @phpstan-ignore-next-line */
                        $action .= '<a class="dropdown-item" href="javascript:toggleShippingAddress(' . $row->id . ');"><i class="fa fa-eye-slash"></i> ' . __('app.hideShippingAddress') . '</a>';
                    } else {
                        /** @phpstan-ignore-next-line */
                        $action .= '<a class="dropdown-item" href="javascript:toggleShippingAddress(' . $row->id . ');"><i class="fa fa-eye"></i> ' . __('app.showShippingAddress') . '</a>';
                    }
                }

                if (
                    $this->deleteInvoicePermission == 'all'
                    || ($this->deleteInvoicePermission == 'added' && ($row->added_by == $userId || $row->added_by == user()->id))
                    || ($this->deleteInvoicePermission == 'owned' && $row->client_id == $userId)
                    || ($this->deleteInvoicePermission == 'both' && ($row->client_id == $userId || $row->added_by == $userId || $row->added_by == user()->id))
                ) {
                    if ($row->status != 'paid' && $row->status != 'partial') {
                        $action .= '<a class="dropdown-item delete-table-row" href="javascript:;" data-toggle="tooltip"  data-invoice-id="' . $row->id . '">
                            <i class="fa fa-trash mr-2"></i>
                            ' . trans('app.delete') . '
                        </a>';
                    }
                }

                $creditNote = $row->credit_note;

                if ($row->status != 'canceled' && isset($row->client) && isset($row->client->clientDetails) && is_null($row->client->clientDetails->shipping_address) && $creditNote == 0) {
                    /** @phpstan-ignore-next-line */
                    $action .= '<a class="dropdown-item" href="javascript:addShippingAddress(' . $row->id . ');"><i class="fa fa-plus"></i> ' . __('app.addShippingAddress') . '</a>';
                }

                if ($row->status != 'canceled' && isset($row->client) && !$row->client->clientDetails && isset($row->project) && isset($row->project->clientDetails) && !is_null($row->project->clientDetails->shipping_address)) {
                    if (isset($row->show_shipping_address) && $row->show_shipping_address === 'yes') {
                        /** @phpstan-ignore-next-line */
                        $action .= '<a class="dropdown-item" href="javascript:toggleShippingAddress(' . $row->id . ');"><i class="fa fa-eye-slash"></i> ' . __('app.hideShippingAddress') . '</a>';
                    } else {
                        /** @phpstan-ignore-next-line */
                        $action .= '<a class="dropdown-item" href="javascript:toggleShippingAddress(' . $row->id . ');"><i class="fa fa-eye"></i> ' . __('app.showShippingAddress') . '</a>';
                    }
                }

                if ($row->status != 'canceled' && isset($row->client) && !$row->client->clientDetails && isset($row->project) && isset($row->project->clientDetails) && is_null($row->project->clientDetails->shipping_address)) {
                    /** @phpstan-ignore-next-line */
                    $action .= '<a class="dropdown-item" href="javascript:addShippingAddress(' . $row->id . ');"><i class="fa fa-plus"></i> ' . __('app.addShippingAddress') . '</a>';
                }

                /* Ends here */

                if ($firstInvoice->id != $row->id && !in_array('client', user_roles()) && ($row->status == 'unpaid' || $row->status == 'draft')) {
                    $action .= '<a class="dropdown-item cancel-invoice" href="javascript:;" data-toggle="tooltip"  data-invoice-id="' . $row->id . '"><i class="fa fa-times mr-2"></i>' . trans('modules.invoices.markCancel') . '</a>';
                }

                if ($row->status != 'paid' && $row->credit_note == 0 && $row->status != 'draft' && $row->status != 'canceled') {
                    $action .= '<a class="dropdown-item" href="' . url()->temporarySignedRoute('front.invoice', now()->addDays(GlobalSetting::SIGNED_ROUTE_EXPIRY), $row->hash) . '" target="_blank"><i class="fa fa-external-link-alt mr-2"></i>' . trans('modules.payments.paymentLink') . '</a>';
                }

                if ($row->credit_note == 0 && $row->status == 'paid' && !in_array('client', user_roles())) {
                    $action .= '<a class="dropdown-item" href="' . route('creditnotes.create') . '?invoice=' . $row->id . '"><i class="fa fa-plus mr-2"></i>' . trans('modules.credit-notes.addCreditNote') . '</a>';
                }

                if ($row->credit_note == 0 && $row->status != 'draft' && $row->status != 'canceled' && $row->status != 'paid' && $row->status != 'unpaid') {
                    $action .= '<a class="dropdown-item unpaidAndPartialPaidCreditNote" data-toggle="tooltip"  data-invoice-id="' . $row->id . '" href="javascript:;"><i class="fa fa-plus mr-2"></i>' . trans('modules.credit-notes.addCreditNote') . '</a>';
                }

                if ($row->status != 'paid' && $row->status != 'draft' && $row->status != 'canceled' && $row->credit_note == 0 && !in_array('client', user_roles()) && $row->send_status) {
                    $action .= '<a class="dropdown-item reminderButton" data-toggle="tooltip"  data-invoice-id="' . $row->id . '" href="javascript:;"><i class="fa fa-bell mr-2"></i>' . trans('app.paymentReminder') . '</a>';
                }

                if ($row->status == 'review') {
                    $action .= '<a class="dropdown-item verify" href="javascript:;" data-toggle="tooltip"  data-invoice-id="' . $row->id . '"><i class="fa fa-trash mr-2"></i>' . trans('app.verify') . '
                    </a>';
                }

                $action .= '</div>
                </div>
            </div>';

                return $action;
            })
            ->editColumn('project_name', function ($row) {
                if ($row->project_id != null) {
                    return '<a href="' . route('projects.show', $row->project_id) . '" class="text-darkest-grey">' . $row->project->project_name . '</a>';
                }

                return '--';
            })
            ->addColumn('client_name', function ($row) {
                if ($row->project && $row->project->client) {
                    return $row->project->client->name;
                } else if ($row->client_id != '') {
                    return $row->client->name;
                } else if ($row->estimate && $row->estimate->client) {
                    return $row->estimate->client->name;
                } else {
                    return '--';
                }
            })
            ->editColumn('name', function ($row) {
                if ($row->project && $row->project->client) {
                    $client = $row->project->client;
                } else if ($row->client_id != '') {
                    $client = $row->client;
                } else if ($row->estimate && $row->estimate->client) {
                    $client = $row->estimate->client;
                } else {
                    return '--';
                }

                return view('components.client', [
                    'user' => $client
                ]);
            })
            ->editColumn('invoices', function ($row) {

                return $row->invoice_number;
            })
            ->editColumn('invoice_number', function ($row) {
                $recurring = '';

                if (!is_null($row->invoice_recurring_id)) {
                    $recurring = '<span class="badge badge-primary"> ' . __('app.recurring') . ' </span>';
                }

                return '<div class="media align-items-center">
                        <div class="media-body">
                    <h5 class="mb-0 f-13 text-darkest-grey"><a href="' . route('invoices.show', [$row->id]) . '">' . $row->invoice_number . '</a></h5>
                    <p class="mb-0">' . $recurring . '</p>
                    </div>
                  </div>';
            })
            ->editColumn('status', function ($row) {
                $status = '';

                if ($row->credit_note) {
                    $status .= ' <i class="fa fa-circle mr-1 text-yellow f-10"></i>' . __('app.credit-note');
                } else {
                    if ($row->status == 'unpaid') {
                        $status .= ' <i class="fa fa-circle mr-1 text-red f-10"></i>' . __('app.' . $row->status);
                    } elseif ($row->status == 'paid') {
                        $status .= ' <i class="fa fa-circle mr-1 text-dark-green f-10"></i>' . __('app.' . $row->status);
                    } elseif ($row->status == 'draft') {
                        $status .= ' <i class="fa fa-circle mr-1 text-blue f-10"></i>' . __('app.' . $row->status);
                    } elseif ($row->status == 'canceled') {
                        $status .= ' <i class="fa fa-circle mr-1 text-red f-10"></i>' . __('app.' . $row->status);
                    } else {
                        $status .= ' <i class="fa fa-circle mr-1 text-blue f-10"></i>' . __('modules.invoices.partial');
                    }
                }

                if (!$row->send_status && $row->status != 'draft') {
                    $status .= '<br><br><span class="badge badge-secondary">' . __('modules.invoices.notSent') . '</span>';
                }

                return $status;
            })
            ->editColumn('total', function ($row) {
                $currencyId = $row->currency->id;

                return '<div class="text-right">' . __('app.total') . ': ' . currency_format($row->total, $currencyId) . '<br><span class="text-success">' . __('app.paid') . ':</span> ' . currency_format($row->amountPaid(), $currencyId) . '<br><span class="text-danger">' . __('app.unpaid') . ':</span> ' . currency_format($row->amountDue(), $currencyId) . '</div>';
            })
            ->editColumn(
                'issue_date',
                function ($row) {
                    return $row->issue_date->timezone($this->company->timezone)->translatedFormat($this->company->date_format);
                }
            )
            ->rawColumns(['project_name', 'action', 'status', 'invoice_number', 'total', 'name'])
            ->removeColumn('currency_symbol')
            ->removeColumn('currency_code')
            ->removeColumn('project_id');
    }

    /**
     * @param Invoice $model
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function query(Invoice $model)
    {
        $request = $this->request();

        $this->firstInvoice = Invoice::orderBy('id', 'desc')->first();
        $this->invoiceSettings = InvoiceSetting::select('invoice_prefix', 'invoice_digit')->first();

        $model = $model->with(['project' => function ($q) {
            $q->withTrashed();
            $q->select('id', 'project_name', 'client_id');
        }, 'currency:id,currency_symbol,currency_code', 'project.client'])
            ->with('client', 'client.session', 'client.clientDetails', 'payment')
            ->select('invoices.id', 'invoices.project_id', 'invoices.client_id', 'invoices.invoice_number', 'invoices.currency_id', 'invoices.total', 'invoices.status', 'invoices.issue_date', 'invoices.credit_note', 'invoices.show_shipping_address', 'invoices.send_status', 'invoices.invoice_recurring_id', 'invoices.hash', 'invoices.company_id');

        if ($request->startDate !== null && $request->startDate != 'null' && $request->startDate != '') {
            $startDate = companyToDateString($request->startDate);
            $model = $model->where(DB::raw('DATE(invoices.`issue_date`)'), '>=', $startDate);
        }

        if ($request->endDate !== null && $request->endDate != 'null' && $request->endDate != '') {
            $endDate = companyToDateString($request->endDate);
            $model = $model->where(DB::raw('DATE(invoices.`issue_date`)'), '<=', $endDate);
        }

        if ($request->status != 'all' && !is_null($request->status)) {
            $model = $model->where('invoices.status', '=', $request->status);
        }

        if ($request->projectID != 'all' && !is_null($request->projectID)) {
            $model = $model->where('invoices.project_id', '=', $request->projectID);
        }

        if ($request->clientID != 'all' && !is_null($request->clientID)) {
            $model = $model->where('client_id', '=', $request->clientID);
        }

        if ($request->searchText != '') {
            $safeTerm = Common::safeString(request('searchText'));
            $model = $model->where(function ($query) use ($safeTerm) {
                $query->where('invoices.invoice_number', 'like', '%' . $safeTerm . '%')
                    ->orWhere('invoices.id', 'like', '%' . $safeTerm . '%')
                    ->orWhere('invoices.total', 'like', '%' . $safeTerm . '%');
            });
        }

        $model = $model->where('invoice_recurring_id', '=', $request->recurringID);

        $model = $model->whereHas('project', function ($q) {
            $q->whereNull('deleted_at');
        }, '>=', 0);

        return $model;
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        $dataTable = $this->setBuilder('recurring-invoices-table', 0)
            ->parameters([
                'initComplete' => 'function () {
                   window.LaravelDataTables["recurring-invoices-table"].buttons().container()
                    .appendTo("#table-actions")
                }',
                'fnDrawCallback' => 'function( oSettings ) {
                    $("body").tooltip({
                        selector: \'[data-toggle="tooltip"]\'
                    })
                }',
            ]);

        if (canDataTableExport()) {
            $dataTable->buttons(Button::make(['extend' => 'excel', 'text' => '<i class="fa fa-file-export"></i> ' . trans('app.exportExcel')]));
        }

        return $dataTable;
    }

    /**
     * Get columns.
     *
     * @return array
     */
    protected function getColumns()
    {
        $modules = $this->user->modules;

        $dsData = [
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => false, 'title' => '#'],
            __('app.id') => ['data' => 'id', 'name' => 'id', 'visible' => false, 'title' => __('app.id')],
            __('app.invoice') . '#' => ['data' => 'invoice_number', 'name' => 'invoice_number', 'exportable' => false, 'title' => __('app.invoice')],
            __('modules.invoices.total') . '#' => ['data' => 'invoices', 'name' => 'invoice_number', 'visible' => false, 'title' => __('modules.invoiceExport')],
            __('app.client') => ['data' => 'name', 'name' => 'project.client.name', 'exportable' => false, 'title' => __('app.client')],
            __('app.customers') => ['data' => 'client_name', 'name' => 'project.client.name', 'visible' => false, 'title' => __('app.customers')],
            __('modules.invoices.total') => ['data' => 'total', 'name' => 'total', 'title' => __('modules.invoices.total')],
            __('modules.invoices.startDate') => ['data' => 'issue_date', 'name' => 'issue_date', 'title' => __('modules.invoices.invoiceDate')],
            __('app.status') => ['data' => 'status', 'name' => 'status', 'title' => __('app.status')],
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->width(150)
                ->addClass('text-right pr-20')
        ];

        if (in_array('projects', $modules)) {
            $dsData = array_slice($dsData, 0, 3, true) + [__('app.project') => ['data' => 'project_name', 'name' => 'project.project_name']] + array_slice($dsData, 3, count($dsData) - 1, true);
        }

        return $dsData;
    }
}

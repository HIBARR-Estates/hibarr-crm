<?php

namespace Modules\Webhooks\Http\Controllers;

use App\Http\Controllers\AccountBaseController;
use Illuminate\Contracts\Support\Renderable;
use Modules\Webhooks\DataTables\WebhookLogsDataTable;
use Modules\Webhooks\Entities\WebhooksLog;

class WebhooksLogController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'webhooks::app.webhooks';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array('webhooks', $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     * @return Renderable
     */
    public function index(WebhookLogsDataTable $dataTable)
    {
        abort_403(user()->permission('view_webhooks_logs') != 'all');
        return $dataTable->render('webhooks::webhooks-log.index', $this->data);
    }

    /**
     * Show the specified resource.
     * @param int $id
     * @return Renderable
     */
    public function show($id)
    {
        abort_403(user()->permission('view_webhooks_logs') != 'all');
        $this->log = WebhooksLog::findOrFail($id);
        return view('webhooks::webhooks-log.show', $this->data);
    }

}

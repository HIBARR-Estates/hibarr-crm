<?php

namespace Modules\Biolinks\Http\Controllers;

use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Modules\Biolinks\Entities\Biolink;
use Modules\Biolinks\Entities\BiolinkBlocks;
use Modules\Biolinks\Entities\BiolinkSetting;
use App\Http\Controllers\AccountBaseController;
use Modules\Biolinks\DataTables\BiolinksDataTable;
use Modules\Biolinks\Entities\BiolinksGlobalSetting;
use Modules\Biolinks\Enums\Status;
use Modules\Biolinks\Http\Requests\CreateBiolinkRequest;

class BiolinksController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'biolinks::app.menu.biolinks';
        $this->baseUrl = URL::to('/');

        $this->middleware(function ($request, $next) {
            abort_403(!in_array(BiolinksGlobalSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     */
    public function index(BiolinksDataTable $dataTable)
    {
        $this->addStudentPermission = user()->permission('add_biolink');

        return $dataTable->render('biolinks::biolinks.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $this->addPermission = user()->permission('add_biolink');

        $this->pageTitle = __('biolinks::app.createBiolinkPage');

        if (request()->ajax()) {
            return view('biolinks::biolinks.ajax.create', $this->data);
        }

        return view('biolinks::biolinks.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(CreateBiolinkRequest $request)
    {
        DB::BeginTransaction();

        $biolink = new Biolink();
        $biolink->company_id = $this->company->id;
        $biolink->page_link = $request->page_link;
        $biolink->status = Status::Active;
        $biolink->save();

        $setting = new BiolinkSetting();
        $setting->biolink_id = $biolink->id;
        $setting->save();

        DB::commit();

        return Reply::successWithData(__('messages.recordSaved'), ['id' => $biolink->id]);
    }

    /**
     * Show the specified resource.
     */
    public function show($id)
    {
        $this->biolink = Biolink::with('biolinkSettings')->findOrFail($id);
        $this->biolinkSettings = $this->biolink->biolinkSettings;

        $this->id = $id;
        $this->blocks = BiolinkBlocks::where('biolink_id', $id)->orderBy('position')->get();

        return view('biolinks::biolinks.edit', $this->data);
    }

    public function showPreview($id)
    {
        $this->biolinkSettings = BiolinkSetting::with('biolink')->where('biolink_id', $id)->first();
        $this->blocks = BiolinkBlocks::where('biolink_id', $id)->orderBy('position')->get();
        $this->baseUrl = request()->getHost();

        $view = 'biolinks::biolinks.ajax.preview';

        $html = view($view, $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'html' => $html]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->biolink = Biolink::with('biolinkSettings')->findOrFail($id);
        $this->biolinkSettings = $this->biolink->biolinkSettings;

        $this->id = $id;
        $this->blocks = BiolinkBlocks::where('biolink_id', $id)->orderBy('position')->get();

        return view('biolinks::biolinks.edit', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(CreateBiolinkRequest $request, $id)
    {
        $biolink = Biolink::findOrFail($id);
        $biolink->update(['page_link' => $request->page_link]);

        return Reply::successWithData(__('messages.recordSaved'), ['id' => $biolink->id]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        Biolink::where('id', $id)->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function changeStatus(Request $request)
    {
        if (!$request->status) {
            return Reply::error(__('messages.selectAction'));
        }

        Biolink::where('id', $request->id)->update(['status' => $request->status]);

        return Reply::success(__('messages.updateSuccess'));
    }

    public function editSlug($id)
    {
        $this->biolink = Biolink::findOrFail($id);

        return view('biolinks::biolinks.ajax.edit-slug', $this->data);
    }

}

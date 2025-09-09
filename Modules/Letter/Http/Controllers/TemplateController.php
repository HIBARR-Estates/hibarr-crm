<?php

namespace Modules\Letter\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Modules\Letter\DataTables\TemplateDataTable;
use Modules\Letter\Entities\LetterSetting;
use Modules\Letter\Entities\Template;
use Modules\Letter\Http\Requests\Template\StoreRequest;
use Modules\Letter\Http\Requests\Template\UpdateRequest;

class TemplateController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'letter::app.menu.template';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array(LetterSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index(TemplateDataTable $dataTable)
    {
        $this->viewPermission = user()->permission('view_template');
        abort_403($this->viewPermission !== 'all');

        return $dataTable->render('letter::template.index', $this->data);
    }

    public function create()
    {
        $this->addPermission = user()->permission('add_template');
        abort_403($this->addPermission !== 'all');

        $this->pageTitle = __('letter::app.addTemplate');

        if (request()->ajax()) {

            $html = view('letter::template.ajax.create', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'letter::template.ajax.create';
        return view('letter::template.create', $this->data);

    }

    public function store(StoreRequest $request)
    {
        $this->addPermission = user()->permission('add_template');
        abort_403($this->addPermission !== 'all');

        $letter = new Template();
        $letter->title = $request->title;
        $letter->description = $request->description;
        $letter->save();

        return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => route('letter.template.index')]);
    }

    public function edit($id)
    {
        $this->editPermission = user()->permission('edit_template');
        abort_403($this->editPermission !== 'all');

        $this->pageTitle = __('letter::app.editTemplate');
        $this->letter = Template::find($id);

        if (request()->ajax()) {

            $html = view('letter::template.ajax.edit', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'letter::template.ajax.edit';
        return view('letter::template.create', $this->data);
    }

    public function update(UpdateRequest $request, $id)
    {
        $this->editPermission = user()->permission('edit_template');
        abort_403($this->editPermission !== 'all');

        $letter = Template::find($id);
        $letter->title = $request->title;
        $letter->description = $request->description;
        $letter->save();
        return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => route('letter.template.index')]);

    }

    public function show($id)
    {
        $this->viewPermission = user()->permission('view_template');
        abort_403($this->viewPermission !== 'all');

        $this->pageTitle = __('letter::app.showTemplate');

        $this->letter = Template::find($id);

        if (request()->ajax()) {
            $html = view('letter::template.ajax.show', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'letter::template.ajax.show';
        return view('letter::template.show', $this->data);
    }

    public function destroy($id)
    {
        $deletePermission = user()->permission('delete_template');
        abort_403($deletePermission !== 'all');

        Template::destroy($id);
        return Reply::success(__('messages.deleteSuccess'));
    }

}

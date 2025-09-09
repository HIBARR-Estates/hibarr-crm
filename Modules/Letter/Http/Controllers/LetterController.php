<?php

namespace Modules\Letter\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\User;
use Illuminate\Http\Request;
use Modules\Letter\DataTables\LetterDataTable;
use Modules\Letter\Entities\Letter;
use Modules\Letter\Entities\LetterSetting;
use Modules\Letter\Entities\Template;
use Modules\Letter\Enums\LetterVariable;
use Modules\Letter\Http\Requests\Letter\StoreRequest;
use Modules\Letter\Http\Requests\Letter\UpdateRequest;

class LetterController extends AccountBaseController
{
    /**
     * Display a listing of the resource.
     */

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'letter::app.menu.letter';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array(LetterSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index(LetterDataTable $dataTable)
    {
        $this->viewPermission = user()->permission('view_letter');
        abort_403($this->viewPermission !== 'all');

        $this->pageTitle = 'letter::app.menu.generate';
        return $dataTable->render('letter::letter.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $this->addPermission = user()->permission('add_letter');
        abort_403($this->addPermission !== 'all');

        $this->pageTitle = __('letter::app.addLetter');

        $this->templates = Template::get();
        $this->employees = User::with('employeeDetail')->onlyEmployee()->get();
        $this->letter = request()->letterId ? Letter::with('user', 'template')->find(request()->letterId) : null;
        $this->employeeLetterVariable = $this->letter ? $this->employeeLetterVariable($this->letter) : [];

        if (request()->ajax()) {

            $html = view('letter::letter.ajax.create', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'letter::letter.ajax.create';
        return view('letter::letter.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreRequest $request)
    {
        $this->addPermission = user()->permission('add_letter');
        abort_403($this->addPermission !== 'all');

        $letter = new Letter();
        $letter->template_id = $request->template_id;
        $letter->user_id = $request->user_id;
        $letter->creator_id = user()->id;
        $letter->name = $request->user_id ? null : $request->employeeName;
        $letter->left = $request->left;
        $letter->right = $request->right;
        $letter->top = $request->top;
        $letter->bottom = $request->bottom;
        $letter->description = $request->description;
        $letter->save();

        return Reply::redirect(route('letter.generate.index'), __('messages.recordSaved'));
    }

    /**
     * Show the specified resource.
     */
    public function show($id)
    {
        $this->viewPermission = user()->permission('view_letter');
        abort_403($this->viewPermission !== 'all');

        $this->letter = Letter::with('user', 'template')->findOrFail($id);
        $this->pageTitle = $this->letter->employee_name . ' - ' . $this->letter->template->title;
        $employeeLetterVariable = $this->employeeLetterVariable($this->letter);
        $description = $this->letter->description;

        foreach ($employeeLetterVariable as $key => $value) {
            $description = str_replace($key, $value, $description);
        }

        $this->description = $description;

        if (request()->ajax()) {
            $html = view('letter::letter.ajax.show', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'letter::letter.ajax.show';
        return view('letter::letter.show', $this->data);

    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->editPermission = user()->permission('edit_letter');
        abort_403($this->editPermission !== 'all');

        $this->pageTitle = __('letter::app.editLetter');
        $this->letter = Letter::with('user', 'template')->findOrFail($id);
        $this->employees = [];

        if ($this->letter->name) {
            $this->employees = User::with('employeeDetail')->onlyEmployee()->get();
        }

        $this->employeeLetterVariable = $this->employeeLetterVariable($this->letter);

        if (request()->ajax()) {
            $html = view('letter::letter.ajax.edit', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'letter::letter.ajax.edit';
        return view('letter::letter.create', $this->data);
    }

    public function update(UpdateRequest $request, $id)
    {
        $this->editPermission = user()->permission('edit_letter');
        abort_403($this->editPermission !== 'all');

        $letter = Letter::findOrFail($id);

        $letter->user_id = $request->user_id;
        $letter->creator_id = user()->id;
        $letter->name = $request->user_id ? null : $request->employeeName;
        $letter->left = $request->left;
        $letter->right = $request->right;
        $letter->top = $request->top;
        $letter->bottom = $request->bottom;
        $letter->description = $request->description;
        $letter->save();

        return Reply::redirect(route('letter.generate.index'), __('messages.updateSuccess'));
    }

    private function employeeLetterVariable($letter)
    {
        $letterVariable = [];

        if ($letter->user_id) {
            $letterVariable = LetterVariable::getMappedValues($letter->user);
        }
        else {
            $letterVariable = [
                '##EMPLOYEE_NAME##' => $letter->name,
            ];
        }

        return $letterVariable;
    }

    public function destroy($id)
    {
        $deletePermission = user()->permission('delete_letter');
        abort_403($deletePermission !== 'all');

        Letter::destroy($id);
        return Reply::success(__('messages.deleteSuccess'));
    }

    public function letterTemplate($id)
    {
        $letter = Template::findOrFail($id);
        return Reply::dataOnly(['status' => 'success', 'letter' => $letter]);
    }

    public function letterEmployee($id)
    {
        $employee = User::with('employeeDetail')->onlyEmployee()->findOrFail($id);

        $letterVariable = [];

        if ($employee) {
            $letterVariable = LetterVariable::getMappedValues($employee);
        }

        return Reply::dataOnly(['status' => 'success', 'employeeLetterVariable' => $letterVariable]);
    }

    public function downloadLetterPreviewStore(Request $request)
    {
        $this->viewPermission = user()->permission('view_letter');
        abort_403($this->viewPermission !== 'all');

        session()->put('letterPreview', $request->description);

        return Reply::dataOnly(['status' => 'success', 'url' => route('letter.download.preview')]);
    }

    public function downloadLetterPreview()
    {
        $this->viewPermission = user()->permission('view_letter');
        abort_403($this->viewPermission !== 'all');

        if (!session()->has('letterPreview')) {
            return abort(404);
        }

        $this->letter = session('letterPreview');
        session()->forget('letterPreview');
        $this->pageTitle = __('letter::app.previewLetter');

        $pdf = app('dompdf.wrapper');
        $pdf->loadView('letter::letter.pdf.preview', $this->data);
        return $pdf->download($this->pageTitle . '.pdf');
    }

    public function downloadLetter($id)
    {
        $this->viewPermission = user()->permission('view_letter');
        abort_403($this->viewPermission !== 'all');

        $this->letter = Letter::with('user', 'template')->findOrFail($id);
        $employeeLetterVariable = $this->employeeLetterVariable($this->letter);
        $description = $this->letter->description;

        foreach ($employeeLetterVariable as $key => $value) {
            $description = str_replace($key, $value, $description);
        }

        $this->description = $description;
        $this->pageTitle = $this->letter->employee_name . ' - ' . $this->letter->template->title;

        $pdf = app('dompdf.wrapper');
        $pdf->loadView('letter::letter.pdf.letter', $this->data);
        return $pdf->download($this->pageTitle . '.pdf');
    }

}

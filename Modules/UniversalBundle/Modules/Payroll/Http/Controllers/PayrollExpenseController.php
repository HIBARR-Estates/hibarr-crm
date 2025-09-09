<?php

namespace Modules\Payroll\Http\Controllers;

use App\DataTables\ExpensesDataTable;
use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Http\Controllers\ExpenseCategoryController;
use App\Http\Requests\Expenses\StoreExpense;
use App\Models\Expense;
use App\Models\Project;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Http\Request;
use Modules\Payroll\DataTables\ExpensesPayrollDataTable;
use Modules\Payroll\DataTables\ExpensesSalarySlipDataTable;
use Modules\Payroll\DataTables\PayrollExpensesDataTable;
use Modules\Payroll\Entities\PayrollSetting;

class PayrollExpenseController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.expenses';
        $this->middleware(function ($request, $next) {
            abort_403(! in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index(PayrollExpensesDataTable $dataTable)
    {
        if (!request()->ajax()) {
            $this->employees = User::allEmployees(null, true);
            $this->projects = Project::allProjects();
            $this->categories = ExpenseCategoryController::getCategoryByCurrentRole();
        }

        return $dataTable->render('payroll::payroll-expenses.index', $this->data);

    }

    public function changeStatus(Request $request)
    {
        abort_403(user()->permission('approve_expenses') != 'all');

        $expenseId = $request->expenseId;
        $status = $request->status;
        $expense = Expense::findOrFail($expenseId);
        $expense->status = $status;
        $expense->save();
        return Reply::success(__('messages.updateSuccess'));
    }

    public function show($id)
    {
        $this->expense = Expense::with(['user', 'project', 'category', 'transactions' => function($q){
            $q->orderByDesc('id')->limit(1);
        }, 'transactions.bankAccount'])->findOrFail($id)->withCustomFields();

        $this->viewPermission = user()->permission('view_expenses');
        $viewProjectPermission = user()->permission('view_project_expenses');
        $this->editExpensePermission = user()->permission('edit_expenses');
        $this->deleteExpensePermission = user()->permission('delete_expenses');

        abort_403(!($this->viewPermission == 'all'
        || ($this->viewPermission == 'added' && $this->expense->added_by == user()->id)
        || ($viewProjectPermission == 'owned' || $this->expense->user_id == user()->id)));

        $this->pageTitle = $this->expense->item_name;


        $getCustomFieldGroupsWithFields = $this->expense->getCustomFieldGroupsWithFields();

        if ($getCustomFieldGroupsWithFields) {
            $this->fields = $getCustomFieldGroupsWithFields->fields;
        }

        $tab = request('tab');

        switch ($tab) {
        case 'payroll':
            return $this->employeePayroll ();
        default:
            $this->view = 'payroll::payroll-expenses.ajax.overview';
            break;
        }

        $this->activeTab = $tab ?: 'overview';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('payroll::payroll-expenses.show', $this->data);

    }

    public function employeePayroll()
    {
        $dataTable = new ExpensesSalarySlipDataTable();

        $tab = request('tab');
        $this->activeTab = $tab ?: 'overview';

        $this->view = 'payroll::payroll-expenses.ajax.expenses-payroll';

        return $dataTable->render('payroll::payroll-expenses.show', $this->data);
    }

    public function showq($id)
    {
        $this->expense = Expense::with(['user', 'project', 'category', 'transactions' => function($q){
            $q->orderByDesc('id')->limit(1);
        }, 'transactions.bankAccount'])->findOrFail($id)->withCustomFields();

        $this->viewPermission = user()->permission('view_expenses');
        $viewProjectPermission = user()->permission('view_project_expenses');
        $this->editExpensePermission = user()->permission('edit_expenses');
        $this->deleteExpensePermission = user()->permission('delete_expenses');

        abort_403(!($this->viewPermission == 'all'
        || ($this->viewPermission == 'added' && $this->expense->added_by == user()->id)
        || ($viewProjectPermission == 'owned' || $this->expense->user_id == user()->id)));

        $getCustomFieldGroupsWithFields = $this->expense->getCustomFieldGroupsWithFields();

        if ($getCustomFieldGroupsWithFields) {
            $this->fields = $getCustomFieldGroupsWithFields->fields;
        }

        $this->pageTitle = $this->expense->item_name;
        $this->view = 'payroll::payroll-expenses.ajax.show';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('expenses.show', $this->data);

    }

    public function destroy($id)
    {
        $this->expense = Expense::findOrFail($id);
        $this->deletePermission = user()->permission('delete_expenses');
        abort_403(!($this->deletePermission == 'all' || ($this->deletePermission == 'added' && $this->expense->added_by == user()->id)));

        Expense::destroy($id);
        return Reply::success(__('messages.deleteSuccess'));
    }

    /**
     * XXXXXXXXXXX
     *
     * @return \Illuminate\Http\Response
     */
    public function applyQuickAction(Request $request)
    {
        switch ($request->action_type) {
        case 'delete':
            $this->deleteRecords($request);
                return Reply::success(__('messages.deleteSuccess'));
        case 'change-status':
            $this->changeBulkStatus($request);
                return Reply::success(__('messages.updateSuccess'));
        default:
                return Reply::error(__('messages.selectAction'));
        }
    }

    protected function deleteRecords($request)
    {
        abort_403(user()->permission('delete_employees') != 'all');

        // Did this to call observer
        foreach (Expense::withoutGlobalScope(ActiveScope::class)->whereIn('id', explode(',', $request->row_ids))->get() as $delete) {
            $delete->delete();
        }
    }

    protected function changeBulkStatus($request)
    {
        abort_403(user()->permission('edit_employees') != 'all');

        $expenses = Expense::withoutGlobalScope(ActiveScope::class)->whereIn('id', explode(',', $request->row_ids))->get();

        $expenses->each(function ($expense) use ($request) {
            $expense->status = $request->status;
            $expense->save();
        });
    }

}

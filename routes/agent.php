<?php

use App\Http\Controllers\AgentWorkspace\AgentWorkspaceController;
use App\Http\Controllers\AgentWorkspace\EarningsController;
use App\Http\Controllers\DealController;
use App\Http\Controllers\LeadContactController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use Illuminate\Support\Facades\Route;

/*
| Agent workspace (crm.agent-workspace + per-user access). Lives at /agent for a
| clean URL; same auth and partner restriction as /account. Anyone without
| access, including everyone while the flag is off, gets a 404. Mutations keep
| calling the existing /account endpoints, so nothing here duplicates an API.
*/
Route::middleware(['auth', 'partner.restrict', EnsureAgentWorkspaceAccess::class])
    ->prefix('agent')
    ->name('agent.')
    ->group(function () {
        Route::redirect('/', '/agent/today')->name('home');
        Route::get('today', [AgentWorkspaceController::class, 'today'])->name('today');
        Route::get('today/agenda', [AgentWorkspaceController::class, 'agenda'])->name('today.agenda');
        // The lead list: runs on the Leads index's own query and checks.
        Route::get('people', [LeadContactController::class, 'agentIndex'])->name('people');
        // One page for a person. Runs on the lead page's own props and checks.
        Route::get('people/{lead}', [LeadContactController::class, 'agentShow'])
            ->whereNumber('lead')
            ->name('people.show');
        // The same page in a deal's state: runs on the deal page's props.
        Route::get('people/{lead}/deals/{deal}', [DealController::class, 'agentShow'])
            ->whereNumber(['lead', 'deal'])
            ->name('people.deal');
        // The deals board and list: runs on the Deals index's own filters and scope.
        Route::get('deals', [DealController::class, 'agentIndex'])->name('deals');
        // Earnings: the MLM module's own commissions, disputes, levels, cycles and network.
        Route::get('earnings', [EarningsController::class, 'overview'])->name('earnings');
        Route::get('earnings/ledger', [EarningsController::class, 'ledger'])->name('earnings.ledger');
        Route::get('earnings/network', [EarningsController::class, 'network'])->name('earnings.network');
        Route::get('earnings/network/{agent}', [EarningsController::class, 'agentPanel'])
            ->whereNumber('agent')
            ->name('earnings.network.agent');
        // A deal by id alone: redirects to its person's page in the deal state.
        Route::get('deals/{deal}', [DealController::class, 'agentOpen'])
            ->whereNumber('deal')
            ->name('deals.show');
    });

<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Http\Controllers\AccountBaseController;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The agent workspace at /agent. Access is checked by the route middleware
 * (EnsureAgentWorkspaceAccess); every page renders inside the persistent
 * AgentWorkspaceLayout, so only page-specific props are sent here and
 * everything beyond the first paint is deferred.
 */
class AgentWorkspaceController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'pages.agent_workspace.today.title';
    }

    public function today(): Response
    {
        return Inertia::render('AgentWorkspace/Today', [
            'pageTitle' => __('pages.agent_workspace.today.title'),
            'userName' => user()->name,
            'now' => now()->toIso8601String(),
        ]);
    }
}

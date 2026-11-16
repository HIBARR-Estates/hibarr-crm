<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Http\Controllers\AccountBaseController;
use App\Services\AgentWorkspace\AgentSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Search in the agent workspace: the dock's dropdown (L7-23) and the results
 * page (L7-24). Both run on {@see AgentSearch}, which applies each source's own
 * visibility rules.
 */
class SearchController extends AccountBaseController
{
    /** Rows per group in the dropdown. */
    private const SUGGEST_LIMIT = 3;

    /** Rows per group on the results page. */
    private const PAGE_LIMIT = 25;

    public function __construct(private AgentSearch $search)
    {
        parent::__construct();
        $this->pageTitle = 'pages.agent_workspace.search_results.title';
    }

    /** The dropdown: a few rows of each group and the counts, as JSON. */
    public function suggest(Request $request): JsonResponse
    {
        return response()->json($this->search->search(AgentSearch::clean($request->query('q')), self::SUGGEST_LIMIT));
    }

    /** The results page: the word and the pill to open with at once, every group's rows deferred. */
    public function results(Request $request): Response
    {
        $query = AgentSearch::clean($request->query('q'));
        $group = $request->query('group');
        $group = in_array($group, AgentSearch::GROUPS, true) ? $group : null;

        return Inertia::render('AgentWorkspace/Search', [
            'pageTitle' => __('pages.agent_workspace.search_results.title'),
            'query' => $query,
            'group' => $group,
            'limit' => self::PAGE_LIMIT,
            'results' => Inertia::defer(fn () => $this->search->search($query, self::PAGE_LIMIT), 'results'),
        ]);
    }
}

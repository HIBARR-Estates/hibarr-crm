<?php

namespace App\Services;

use App\Models\AgentHierarchy;
use App\Models\LeadAgent;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class HierarchyService
{
    /**
     * Set the parent for a child agent and rebuild the closure table entries.
     *
     * This handles both initial assignment and re-parenting.
     */
    public function setParent(LeadAgent $child, LeadAgent $parent): void
    {
        DB::transaction(function () use ($child, $parent) {
            // Remove existing closure entries where child is a descendant
            $this->detachSubtree($child);

            // Set the direct parent FK
            $child->parent_agent_id = $parent->id;
            $child->saveQuietly();

            // Rebuild closure entries for the child subtree under the new parent
            $this->attachSubtree($child, $parent);
        });

        Log::info("Hierarchy: Agent {$child->id} assigned under parent {$parent->id}");
    }

    /**
     * Remove an agent from the hierarchy (clear parent).
     */
    public function removeParent(LeadAgent $agent): void
    {
        DB::transaction(function () use ($agent) {
            $this->detachSubtree($agent);

            $agent->parent_agent_id = null;
            $agent->saveQuietly();

            // Re-attach the subtree as a root (only child→descendant links remain)
            $this->rebuildSubtreeClosures($agent);
        });

        Log::info("Hierarchy: Agent {$agent->id} removed from parent hierarchy");
    }

    /**
     * Get all ancestors of an agent ordered by depth ASC (closest first).
     *
     * @return Collection<int, LeadAgent>
     */
    public function getAncestors(LeadAgent $agent): Collection
    {
        return LeadAgent::select('lead_agents.*', 'agent_hierarchy.depth')
            ->join('agent_hierarchy', 'lead_agents.id', '=', 'agent_hierarchy.ancestor_id')
            ->where('agent_hierarchy.descendant_id', $agent->id)
            ->orderBy('agent_hierarchy.depth', 'asc')
            ->get();
    }

    /**
     * Get ancestors with their current levels for commission traversal.
     * Ordered by depth ASC (closest ancestor first).
     *
     * @return Collection<int, LeadAgent>
     */
    public function getAncestorsWithLevels(LeadAgent $agent): Collection
    {
        return $this->getAncestors($agent)->load('currentLevelHistory.level');
    }

    /**
     * Get all descendants of an agent ordered by depth ASC.
     *
     * @return Collection<int, LeadAgent>
     */
    public function getDescendants(LeadAgent $agent): Collection
    {
        return LeadAgent::select('lead_agents.*', 'agent_hierarchy.depth')
            ->join('agent_hierarchy', 'lead_agents.id', '=', 'agent_hierarchy.descendant_id')
            ->where('agent_hierarchy.ancestor_id', $agent->id)
            ->orderBy('agent_hierarchy.depth', 'asc')
            ->get();
    }

    /**
     * Rebuild the entire closure table from parent_agent_id fields.
     * Useful for repair/backfill operations.
     */
    public function rebuildAll(?int $companyId = null): int
    {
        $query = LeadAgent::whereNotNull('parent_agent_id');
        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        // Clear existing entries
        $deleteQuery = AgentHierarchy::query();
        if ($companyId) {
            $deleteQuery->where('company_id', $companyId);
        }
        $deleteQuery->delete();

        $count = 0;

        // Process each agent that has a parent
        $agents = $query->get();
        foreach ($agents as $agent) {
            $this->buildClosureForAgent($agent);
            $count++;
        }

        Log::info("Hierarchy: Rebuilt closure table for {$count} agents" . ($companyId ? " (company {$companyId})" : ''));

        return $count;
    }

    // ── Private Helpers ──────────────────────────────────────────

    /**
     * Detach a subtree from its current position in the closure table.
     * Removes all closure entries where any node in the subtree is a descendant
     * of any node outside the subtree.
     */
    private function detachSubtree(LeadAgent $agent): void
    {
        // Get all descendant IDs of this agent (including indirect)
        $subtreeIds = AgentHierarchy::where('ancestor_id', $agent->id)
            ->pluck('descendant_id')
            ->push($agent->id)
            ->unique()
            ->toArray();

        // Remove rows where a descendant in the subtree links to an ancestor outside the subtree
        AgentHierarchy::whereIn('descendant_id', $subtreeIds)
            ->whereNotIn('ancestor_id', $subtreeIds)
            ->delete();
    }

    /**
     * Attach a subtree under a new parent in the closure table.
     */
    private function attachSubtree(LeadAgent $child, LeadAgent $parent): void
    {
        // Get the child's subtree descendants (if any)
        $subtreeLinks = AgentHierarchy::where('ancestor_id', $child->id)->get();

        // Get all ancestors of the parent (+ parent itself)
        $parentAncestors = AgentHierarchy::where('descendant_id', $parent->id)
            ->select('ancestor_id', 'depth')
            ->get();

        $companyId = $child->company_id;
        $inserts = [];
        $now = now();

        // 1. Link: parent → child (depth 1)
        $inserts[] = [
            'company_id' => $companyId,
            'ancestor_id' => $parent->id,
            'descendant_id' => $child->id,
            'depth' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        // 2. Link: each parent ancestor → child
        foreach ($parentAncestors as $pa) {
            $inserts[] = [
                'company_id' => $companyId,
                'ancestor_id' => $pa->ancestor_id,
                'descendant_id' => $child->id,
                'depth' => $pa->depth + 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // 3. Link: parent + parent ancestors → each child descendant
        foreach ($subtreeLinks as $sl) {
            // parent → child's descendant
            $inserts[] = [
                'company_id' => $companyId,
                'ancestor_id' => $parent->id,
                'descendant_id' => $sl->descendant_id,
                'depth' => 1 + $sl->depth,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            // each parent ancestor → child's descendant
            foreach ($parentAncestors as $pa) {
                $inserts[] = [
                    'company_id' => $companyId,
                    'ancestor_id' => $pa->ancestor_id,
                    'descendant_id' => $sl->descendant_id,
                    'depth' => $pa->depth + 1 + $sl->depth,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if (!empty($inserts)) {
            AgentHierarchy::insert($inserts);
        }
    }

    /**
     * Rebuild closure entries for a single agent's subtree (for root agents).
     */
    private function rebuildSubtreeClosures(LeadAgent $agent): void
    {
        // Get direct children via parent_agent_id
        $children = LeadAgent::where('parent_agent_id', $agent->id)->get();

        foreach ($children as $child) {
            $this->buildClosureForAgent($child);
        }
    }

    /**
     * Build closure table entries for a single agent by walking up parent_agent_id.
     */
    private function buildClosureForAgent(LeadAgent $agent): void
    {
        $ancestors = [];
        $current = $agent;
        $depth = 0;

        // Walk up the parent chain
        while ($current->parent_agent_id) {
            $depth++;
            $ancestors[] = [
                'company_id' => $agent->company_id,
                'ancestor_id' => $current->parent_agent_id,
                'descendant_id' => $agent->id,
                'depth' => $depth,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $current = LeadAgent::find($current->parent_agent_id);
            if (!$current) {
                break;
            }
        }

        if (!empty($ancestors)) {
            // Upsert to avoid duplicate constraint violations
            foreach ($ancestors as $entry) {
                AgentHierarchy::updateOrCreate(
                    ['ancestor_id' => $entry['ancestor_id'], 'descendant_id' => $entry['descendant_id']],
                    $entry
                );
            }
        }
    }
}

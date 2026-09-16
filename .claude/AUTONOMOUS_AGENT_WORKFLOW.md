# Autonomous agent workflow: Jira → branch → PR

How an agent acting fully autonomously (no human approving each step) should
turn a task description into a tracked Jira issue, a correctly-named branch,
and a pull request back to `develop`. This documents the sequence actually
used for HIB-1666 ("Add product tour to personal dashboard") as a concrete
example other agents can follow.

## 1. Research before creating anything

Do not create the Jira issue, branch, or any code until you know what you're
building. Concretely, before touching Jira or git:

- Find the exact file(s) the task is about and read them.
- Find the feature flag (if any) that should gate the change — check
  `config/features.php` (backend `known_flags`) and how it's read
  server-side (`FeatureFlags::enabled()`) and client-side
  (`usePage().props.featureFlags?.["..."]`). Reuse an existing flag when the
  task says to gate on "the same flag that gates X" — do not invent a new
  one unless asked.
- Find the closest existing precedent and read it in full, not just grep
  hits. For UI patterns (like the product tour engine used here), there is
  usually more than one existing consumer (e.g. `dealTourSteps.ts`,
  `leadTourSteps.ts`, `preferencesTourSteps.ts`) — read at least two so you
  can tell what's incidental to one page versus load-bearing convention.
- Check `.claude/briefs/*.md` and `docs/*.md` for a written spec or a brief
  that already covers this surface. A brief that looks aspirational may
  already be fully implemented — verify by checking whether the files it
  describes exist, don't assume from the filename alone.
- Confirm which Jira project/cloud to use. List accessible Atlassian
  resources and visible projects (with `action: "create"`) rather than
  guessing a project key — a repo can have more than one project (e.g. an
  Engineering project and a separate IT project), and only one may have the
  issue type you need.

Parallelize independent research (e.g. codebase exploration and Jira project
lookup) as separate background agents/tool calls rather than doing it
serially — but don't create the Jira issue or branch until the research
you're about to act on has actually come back.

## 2. Create the Jira issue

- Use the project the research step confirmed (key, not name).
- Issue type: `Task` for a scoped, well-defined piece of work; reserve
  `Story`/`Epic` for larger, multi-PR efforts.
- Summary: short, imperative, matches what the PR title will be.
- Description: include what's being built, the approach (file paths,
  reused components/flags), and acceptance criteria. This becomes the
  source of truth for anyone (human or agent) picking up the issue later —
  write it as if the branch/PR didn't exist yet.
- Record the returned issue key (e.g. `HIB-1666`) — everything downstream
  is named from it.

## 3. Derive the branch name from the Jira key and create it

This repo's convention (no Jira/git integration auto-suggests a name, so
construct it manually):

```
<ISSUE-KEY>-<kebab-case-summary>
```

e.g. `HIB-1666-add-product-tour-to-personal-dashboard`. Lowercase, hyphens,
no issue-type prefix, summary trimmed to stay reasonably short.

Create it from an up-to-date `develop`, not from whatever branch the
environment happened to check out at session start:

```bash
git fetch origin develop
git checkout -B <ISSUE-KEY>-<kebab-case-summary> origin/develop
```

`checkout -B` (not `-b`) so this is safe to re-run — it resets the branch to
match `develop` if it already exists locally from a previous attempt,
instead of failing.

**If your execution environment pre-assigns a different branch name** (for
example, a harness convention like `claude/<slug>`) and the task explicitly
asks for a Jira-derived branch name instead, that's a direct, in-conversation
instruction from the person who owns the task — follow it and work on the
Jira-named branch. Don't silently comply with a stale default when the
current instruction overrides it; also don't reinterpret an implicit task as
license to ignore branch-naming rules that weren't actually superseded.

## 4. Implement, following existing precedent exactly

- Reuse existing components/hooks/primitives before adding new ones. If a
  shared component (like a panel wrapper) needs one more optional prop to
  support the new feature (e.g. a `data-tour` target), extend it narrowly
  rather than duplicating it or reaching into its internals from outside.
- Match the exact shape of the precedent you read in step 1: same file
  naming (`config/xTourSteps.ts`), same export names (`X_TOUR_ID`,
  `X_TOUR_LABELS`, `buildXTourSteps()`), same lang-key namespace
  (`pages.<area>.tour.steps.<step>.<field>`).
- Translate into every locale the precedent covers, not just the source
  language — check which `resources/lang/<locale>/pages.php` files actually
  carry the relevant top-level key today (not every locale directory has
  every file) and match that set.
- Validate what you can without a full dev environment: `php -l` on every
  edited PHP/lang file is cheap and catches syntax mistakes; if a JS
  toolchain (`node_modules`, `tsc`) isn't installed and installing it is
  expensive, say so explicitly rather than claiming a type-check passed.
  Re-read your own diff end-to-end as the substitute check.

## 5. Commit, push, open the PR

```bash
git add <changed files>          # explicit paths, not -A
git commit -m "..."              # imperative summary + why, reference the Jira key
git push -u origin <branch-name>
```

Before opening the PR, check for `.github/pull_request_template.md` (or the
other conventional locations) and mirror its sections if one exists; this
repo currently has none, so a plain Summary/Related/Test plan body is fine.

Open the PR with `base: develop`, `head: <branch-name>`. Include:
- A summary of what changed and why, file-path-anchored.
- A link to the Jira issue.
- A test plan — mark backend checks you actually ran (`php -l`, etc.) as
  done, and mark anything requiring a running app/browser as unchecked
  with a note on why it wasn't run in this environment, rather than
  claiming untested UI behavior works.

Do not create the PR before the branch is pushed, and do not push before the
working tree is in a state you've actually reviewed (`git diff` the full
changeset, not just the files you remember touching).

## 6. Don't merge

Creating the PR is the end of the autonomous portion of this workflow unless
explicitly told otherwise. Leave it for human review; if asked to watch it,
subscribe to PR activity and follow the repo's own PR-babysitting rules
rather than merging or force-pushing unilaterally.

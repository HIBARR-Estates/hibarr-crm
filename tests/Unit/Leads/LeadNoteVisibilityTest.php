<?php

namespace Tests\Unit\Leads;

use App\Models\LeadNote;
use App\Models\LeadUserNote;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * The Lead page lists a lead's notes, and a Note carries its own read scope
 * (`view_lead_note`) plus a private-note member list. These tests pin the
 * shared rule (LeadNote::scopeVisibleTo / LeadNote::isVisibleTo) that both the
 * Lead page's list and the direct note page apply, so a note is never
 * readable through one route and hidden through another.
 */
class LeadNoteVisibilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('lead_user_notes');
        Schema::dropIfExists('lead_notes');

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedBigInteger('added_by')->nullable();
            $table->string('title')->nullable();
            $table->text('details')->nullable();
            $table->integer('type')->default(0);
            $table->integer('is_lead_show')->default(0);
            $table->integer('ask_password')->default(0);
            $table->timestamps();
        });

        Schema::create('lead_user_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('lead_note_id')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Mockery::close();

        Schema::dropIfExists('lead_user_notes');
        Schema::dropIfExists('lead_notes');

        parent::tearDown();
    }

    public function test_none_scope_returns_no_notes(): void
    {
        $this->seedNotes();

        $visible = LeadNote::where('lead_id', 1)->visibleTo($this->viewer('none'))->get();

        $this->assertCount(0, $visible);
    }

    public function test_added_scope_returns_only_own_notes(): void
    {
        $this->seedNotes();

        $visible = LeadNote::where('lead_id', 1)->visibleTo($this->viewer('added'))->get();

        $this->assertCount(1, $visible);
        $this->assertSame('Mine', $visible->first()->title);
    }

    public function test_both_scope_returns_own_and_member_notes(): void
    {
        $this->seedNotes();

        $visible = LeadNote::where('lead_id', 1)->visibleTo($this->viewer('both'))->get();

        $this->assertCount(2, $visible);
        $this->assertEqualsCanonicalizing(
            ['Mine', 'Shared with me'],
            $visible->pluck('title')->all()
        );
    }

    public function test_all_scope_hides_another_authors_private_note(): void
    {
        $this->seedNotes();

        // The `all` scope widens the *scope*, not the private-note policy:
        // a non-admin still only sees a private note they authored or are a
        // member of.
        $visible = LeadNote::where('lead_id', 1)->visibleTo($this->viewer('all'))->get();

        $this->assertEqualsCanonicalizing(
            ['Mine', 'Shared with me'],
            $visible->pluck('title')->all()
        );
    }

    public function test_all_scope_returns_every_note_for_an_admin(): void
    {
        $this->seedNotes();

        $visible = LeadNote::where('lead_id', 1)
            ->visibleTo($this->viewer('all', 10, ['admin']))
            ->get();

        $this->assertCount(3, $visible);
    }

    public function test_all_scope_keeps_public_notes_readable(): void
    {
        $this->seedNotes();

        $visible = LeadNote::where('lead_id', 1)->visibleTo($this->viewer('all', 99))->get();

        $this->assertEqualsCanonicalizing(
            ['Mine'],
            $visible->pluck('title')->all()
        );
    }

    public function test_is_visible_to_applies_the_private_note_policy(): void
    {
        $this->seedNotes();

        $viewer = $this->viewer('all', 99);
        $theirs = LeadNote::where('title', 'Theirs')->first();

        $this->assertFalse($theirs->isVisibleTo($viewer));
    }

    public function test_is_visible_to_allows_an_admin_to_read_a_private_note(): void
    {
        $this->seedNotes();

        $admin = $this->viewer('all', 99, ['admin']);
        $theirs = LeadNote::where('title', 'Theirs')->first();

        $this->assertTrue($theirs->isVisibleTo($admin));
    }

    public function test_owned_scope_requires_membership(): void
    {
        $this->seedNotes();

        // User 5 is not a member of the shared note and does not author it.
        $visible = LeadNote::where('lead_id', 1)->visibleTo($this->viewer('owned', 5))->get();

        $this->assertCount(0, $visible);
    }

    public function test_is_visible_to_matches_the_scope(): void
    {
        $this->seedNotes();

        $author = $this->viewer('added', 10);
        $note = LeadNote::where('title', 'Mine')->first();

        $this->assertTrue($note->isVisibleTo($author));
    }

    public function test_is_visible_to_rejects_another_authors_note(): void
    {
        $this->seedNotes();

        $viewer = $this->viewer('added', 99);
        $note = LeadNote::where('title', 'Theirs')->first();

        $this->assertFalse($note->isVisibleTo($viewer));
    }

    public function test_edit_permission_none_blocks_everyone(): void
    {
        $this->seedNotes();

        $note = LeadNote::where('title', 'Mine')->first();

        $this->assertFalse($note->isEditableBy($this->editor('none')));
    }

    public function test_edit_permission_all_allows_editing(): void
    {
        $this->seedNotes();

        $note = LeadNote::where('title', 'Theirs')->first();

        $this->assertTrue($note->isEditableBy($this->editor('all')));
    }

    public function test_edit_permission_added_only_allows_the_author(): void
    {
        $this->seedNotes();

        $note = LeadNote::where('title', 'Mine')->first();

        $this->assertTrue($note->isEditableBy($this->editor('added', 10)));
        $this->assertFalse($note->isEditableBy($this->editor('added', 99)));
    }

    public function test_edit_permission_both_allows_a_member(): void
    {
        $this->seedNotes();

        $shared = LeadNote::where('title', 'Shared with me')->first();

        $this->assertTrue($shared->isEditableBy($this->editor('both', 10)));
        $this->assertFalse($shared->isEditableBy($this->editor('both', 99)));
    }

    /**
     * @return array{0: LeadNote, 1: LeadNote, 2: LeadNote}
     */
    private function seedNotes(): array
    {
        $mine = LeadNote::create([
            'lead_id' => 1,
            'added_by' => 10,
            'title' => 'Mine',
            'details' => 'mine',
            'type' => 0,
        ]);

        $shared = LeadNote::create([
            'lead_id' => 1,
            'added_by' => 20,
            'title' => 'Shared with me',
            'details' => 'shared',
            'type' => 1,
        ]);

        $theirs = LeadNote::create([
            'lead_id' => 1,
            'added_by' => 20,
            'title' => 'Theirs',
            'details' => 'theirs',
            'type' => 1,
        ]);

        LeadUserNote::create(['user_id' => 10, 'lead_note_id' => $shared->id]);

        return [$mine, $shared, $theirs];
    }

    /**
     * A viewer with the given `view_lead_note` scope.
     *
     * @param  array<int, string>  $roles
     */
    private function viewer(string $scope, int $userId = 10, array $roles = []): User
    {
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = $userId;

        $user->shouldReceive('permission')
            ->with('view_lead_note')
            ->andReturn($scope);

        $user->setRelation('roles', collect(array_map(
            fn (string $role) => (object) ['name' => $role],
            $roles
        )));

        return $user;
    }

    /**
     * A viewer with the given `edit_lead_note` scope.
     */
    private function editor(string $scope, int $userId = 10): User
    {
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = $userId;

        $user->shouldReceive('permission')
            ->with('edit_lead_note')
            ->andReturn($scope);

        $user->setRelation('roles', collect());

        return $user;
    }
}

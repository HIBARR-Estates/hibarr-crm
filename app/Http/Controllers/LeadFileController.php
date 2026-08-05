<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Deal;
use App\Models\DealFile;
use App\Services\FileStorageService;
use App\Services\PermissionService;
use App\Traits\IconTrait;
use Illuminate\Http\Request;
use App\Helper\Files;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class LeadFileController extends AccountBaseController
{

    use IconTrait;

    /**
     * ManageLeadFileController constructor.
     */

    protected FileStorageService $fileStorageService;

    public function __construct(FileStorageService $fileStorageService)
    {
        parent::__construct();
        $this->pageIcon = 'icon-people';
        $this->pageTitle = 'app.menu.lead';
        $this->fileStorageService = $fileStorageService;
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */

    public function create()
    {
        $addPermission = user()->permission('add_lead_files');
        abort_403(!in_array($addPermission, ['all', 'added']));

        return view('leads.lead-files.create', $this->data);
    }

    /**
     * @param Request $request
     * @return array
     * @throws \GuzzleHttp\Exception\GuzzleException
     * @throws \Throwable
     */
    public function store(Request $request)
    {
        $addPermission = user()->permission('add_lead_files');
        abort_403(!in_array($addPermission, ['all', 'added']));

        $createdFiles = [];

        $uploaded = $request->file('file');
        if ($uploaded instanceof \Illuminate\Http\UploadedFile) {
            $uploaded = [$uploaded];
        }

        if (is_array($uploaded)) {
            foreach ($uploaded as $fileData) {
                if (!$fileData instanceof \Illuminate\Http\UploadedFile) {
                    continue;
                }

                $file = new DealFile();

                $file->deal_id = $request->lead_id;
                $file->user_id = $this->user->id;
                $file->added_by = $this->user->id;
                $file->filename = $fileData->getClientOriginalName();
                $file->size = $fileData->getSize();

                // Upload via the external FileStorageService (matches storeFromExternal /
                // CustomFieldsTrait), falling back to legacy local/S3 storage if unavailable.
                try {
                    $result = $this->fileStorageService->upload($fileData, 'deal-files/' . $request->lead_id);
                    $file->external_url = $result['downloadUrl'];
                    $file->object_path = $result['objectPath'];
                    $file->hashname = '';
                } catch (\Exception $e) {
                    Log::error('Deal file upload failed', [
                        'error' => $e->getMessage(),
                        'deal_id' => $request->lead_id,
                    ]);
                    $file->hashname = Files::uploadLocalOrS3($fileData, DealFile::FILE_PATH . '/' . $request->lead_id);
                }

                $file->save();
                $createdFiles[] = $file;
            }
        }

        $this->lead = Deal::findOrFail($request->lead_id);

        return Reply::successWithData(__('messages.fileUploaded'), ['data' => $createdFiles]);
    }

    /**
     * @param Request $request
     * @param int $id
     * @return array
     */
    public function update(Request $request, $id)
    {
        $editPermission = user()->permission('edit_lead_files');
        $file = DealFile::findOrFail($id);
        abort_403(!($editPermission == 'all' || ($editPermission == 'added' && $file->added_by == user()->id)));

        $file->description = $request->description;
        $file->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Store file references from external storage (2-step upload).
     *
     * The frontend uploads files directly to the external storage API,
     * then calls this endpoint with the upload results to create DealFile records.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function storeFromExternal(Request $request)
    {
        $addPermission = user()->permission('add_lead_files');
        abort_403(!in_array($addPermission, ['all', 'added']));

        $request->validate([
            'deal_id' => 'required|integer|exists:deals,id',
            'files' => 'required|array|min:1',
            'files.*.downloadUrl' => 'required|url',
            'files.*.objectPath' => 'required|string',
            'files.*.originalName' => 'required|string',
            'files.*.size' => 'nullable|integer',
        ]);

        $deal = Deal::findOrFail($request->deal_id);
        $createdFiles = [];

        foreach ($request->input('files') as $fileData) {
            $file = new DealFile();
            $file->deal_id = $deal->id;
            $file->user_id = $this->user->id;
            $file->filename = $fileData['originalName'];
            $file->hashname = ''; // Not used for external files
            $file->size = $fileData['size'] ?? 0;
            $file->external_url = $fileData['downloadUrl'];
            $file->object_path = $fileData['objectPath'];
            $file->added_by = $this->user->id;
            $file->save();

            $createdFiles[] = $file;
        }

        return response()->json([
            'status' => 'success',
            'message' => __('messages.fileUploaded'),
            'data' => $createdFiles,
        ]);
    }

    /**
     * @param Request $request
     * @param int $id
     * @return array|void
     */

    public function destroy(Request $request, $id)
    {
        $deletePermission = user()->permission('delete_lead_files');
        $file = DealFile::findOrFail($id);
        abort_403(!($deletePermission == 'all' || ($deletePermission == 'added' && $file->added_by == user()->id)));

        // If the file is stored externally, also delete from external storage
        if ($file->isExternallyStored() && !empty($file->object_path)) {
            try {
                $fileStorageService = app(FileStorageService::class);
                $fileStorageService->delete($file->object_path);
            } catch (\Exception $e) {
                Log::warning('Failed to delete file from external storage', [
                    'file_id' => $file->id,
                    'object_path' => $file->object_path,
                    'error' => $e->getMessage(),
                ]);
                // Continue with database deletion even if external deletion fails
            }
        }

        DealFile::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));

    }

    /**
     * JSON endpoint for the files tab — fetched independently by the frontend
     * instead of riding the deal page's deferred-prop bundle. Logic relocated
     * verbatim from the former `files` deferred prop on DealController::show().
     */
    public function dealFiles(Request $request, $dealId)
    {
        $deal = Deal::findOrFail($dealId);
        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ];
        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, $dealRules);
        abort_403(!$access['canAccess']);

        $files = $deal->files()->orderBy('created_at', 'desc')->get();
        if (user()->permission('view_lead_files') == 'added') {
            $files = $files->where('added_by', user()->id)->values();
        }

        return response()->json(['status' => 'success', 'data' => $files]);
    }

    /**
     * @param mixed $id
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse|\Symfony\Component\HttpFoundation\StreamedResponse|void
     */
    public function download($id)
    {
        $viewPermission = user()->permission('view_lead_files');
        $file = DealFile::findOrFail($id);
        abort_403(!($viewPermission == 'all' || ($viewPermission == 'added' && $file->added_by == user()->id)));

        // External files: redirect to the external URL
        if ($file->isExternallyStored()) {
            return redirect()->away($file->external_url);
        }

        // Legacy files: serve from local/S3 storage
        return download_local_s3($file, DealFile::FILE_PATH . '/' . $file->deal_id . '/' . $file->hashname);
    }

    /**
     * @param Request $request
     * @return mixed
     */
    public function layout(Request $request)
    {
        $viewPermission = user()->permission('view_lead_files');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $this->deal = Deal::with('files')->findOrFail($request->id);

        $layout = $request->layout == 'listview' ? 'leads.lead-files.ajax-list' : 'leads.lead-files.thumbnail-list';

        $view = view($layout, $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'html' => $view]);
    }

}

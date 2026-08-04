<?php

namespace App\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use App\Models\Lead;
use App\Models\LeadContactFile;
use App\Services\FileStorageService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Standalone multi-file uploads for lead contacts.
 * File-typed custom fields are updated via LeadContactController::patch.
 */
class LeadContactFileController extends AccountBaseController
{
    protected FileStorageService $fileStorageService;

    public function __construct(FileStorageService $fileStorageService)
    {
        parent::__construct();
        $this->fileStorageService = $fileStorageService;
    }

    public function index(Request $request, $leadId)
    {
        $lead = Lead::findOrFail($leadId);
        $this->assertLeadAccess($lead, 'view_lead');

        $files = $lead->files()->orderByDesc('created_at')->get();

        return response()->json(['status' => 'success', 'data' => $files]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'lead_id' => 'required|integer|exists:leads,id',
            'file' => 'required',
            'file.*' => 'file',
        ]);

        $lead = Lead::findOrFail($request->lead_id);
        $this->assertLeadAccess($lead, 'edit_lead');

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

                $file = new LeadContactFile();
                $file->lead_id = $lead->id;
                $file->user_id = $this->user->id;
                $file->added_by = $this->user->id;
                $file->filename = $fileData->getClientOriginalName();
                $file->size = (string) $fileData->getSize();

                try {
                    $result = $this->fileStorageService->upload(
                        $fileData,
                        'lead-contact-files/' . $lead->id
                    );
                    $file->external_url = $result['downloadUrl'];
                    $file->object_path = $result['objectPath'];
                    $file->hashname = '';
                } catch (\Exception $e) {
                    Log::error('Lead contact file upload failed', [
                        'error' => $e->getMessage(),
                        'lead_id' => $lead->id,
                    ]);
                    $file->hashname = Files::uploadLocalOrS3(
                        $fileData,
                        LeadContactFile::FILE_PATH . '/' . $lead->id
                    );
                }

                $file->save();
                $createdFiles[] = $file;
            }
        }

        return Reply::successWithData(__('messages.fileUploaded'), [
            'data' => $createdFiles,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $file = LeadContactFile::findOrFail($id);
        $lead = Lead::findOrFail($file->lead_id);
        $this->assertLeadAccess($lead, 'edit_lead');

        if ($file->isExternallyStored() && !empty($file->object_path)) {
            try {
                $this->fileStorageService->delete($file->object_path);
            } catch (\Exception $e) {
                Log::warning('Failed to delete lead contact file from external storage', [
                    'file_id' => $file->id,
                    'object_path' => $file->object_path,
                    'error' => $e->getMessage(),
                ]);
            }
        } elseif (!empty($file->hashname)) {
            Files::deleteFile(
                $file->hashname,
                LeadContactFile::FILE_PATH . '/' . $file->lead_id
            );
        }

        LeadContactFile::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function download($id)
    {
        $file = LeadContactFile::findOrFail($id);
        $lead = Lead::findOrFail($file->lead_id);
        $this->assertLeadAccess($lead, 'view_lead');

        if ($file->isExternallyStored()) {
            return redirect()->away($file->external_url);
        }

        return download_local_s3(
            $file,
            LeadContactFile::FILE_PATH . '/' . $file->lead_id . '/' . $file->hashname
        );
    }

    /**
     * @param  'view_lead'|'edit_lead'  $permission
     */
    protected function assertLeadAccess(Lead $lead, string $permission): void
    {
        $access = PermissionService::checkAccess(user(), $permission, $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);
        abort_403(!$access['canAccess']);
    }
}

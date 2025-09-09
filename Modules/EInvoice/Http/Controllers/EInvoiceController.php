<?php

namespace Modules\EInvoice\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\ClientDetails;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;
use Modules\EInvoice\DataTables\InvoicesDataTable;
use Modules\EInvoice\Entities\EInvoiceCompanySetting;
use Modules\EInvoice\Helper\InvoiceXmlGenerate;
use Saloon\XmlWrangler\Data\RootElement;
use Saloon\XmlWrangler\XmlWriter;

class EInvoiceController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'einvoice::app.menu.einvoice';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array('invoices', $this->user->modules));

            return $next($request);
        });
    }

    public function index(InvoicesDataTable $dataTable)
    {
        $viewPermission = user()->permission('view_invoices');
        abort_403(!in_array($viewPermission, ['all', 'added', 'owned', 'both']));

        if (!request()->ajax()) {
            $this->projects = Project::allProjects();

            if (in_array('client', user_roles())) {
                $this->clients = User::client();
            }
            else {
                $this->clients = User::allClients();
            }
        }

        return $dataTable->render('einvoice::index', $this->data);
    }

    public function exportXml($id)
    {
        $viewPermission = user()->permission('view_invoices');
        abort_403(!in_array($viewPermission, ['all', 'added', 'owned', 'both']));

        $invoice = Invoice::with('client')->findOrFail($id);

        if (!$invoice->client?->clientdetails?->electronic_address || !$invoice->client?->clientdetails?->electronic_address_scheme) {
            return redirect()->route('einvoice.index')->with('message', __('einvoice::app.clientElectronicAddressNotSet'));
        }

        $array = [];

        $writer = new XmlWriter();

        $rootElement = RootElement::make('Invoice', attributes: [
            'xmlns' => 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
            'xmlns:cbc' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
            'xmlns:cac' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        ]);

        $array = InvoiceXmlGenerate::generateXml($invoice);

        $xml = $writer->write($rootElement, $array);

        return response()->streamDownload(function () use ($xml) {
            echo $xml;
        }, $invoice->invoice_number . '.xml');
    }

    public function settings()
    {
        abort_403(user()->permission('manage_finance_setting') != 'all');

        $this->activeSettingMenu = 'einvoice_settings';
        $this->pageTitle = 'einvoice::app.menu.einvoiceSettings';

        return view('einvoice::settings.index', $this->data);
    }

    public function settingsModal()
    {
        abort_403(user()->permission('manage_finance_setting') != 'all');

        return view('einvoice::settings.modal');
    }

    public function saveSettings(Request $request)
    {
        abort_403(user()->permission('manage_finance_setting') != 'all');

        EInvoiceCompanySetting::updateOrCreate(
            ['company_id' => company()->id],
            [
                'electronic_address' => $request->electronic_address,
                'electronic_address_scheme' => $request->electronic_address_scheme,
                'e_invoice_company_id' => $request->e_invoice_company_id,
                'e_invoice_company_id_scheme' => $request->e_invoice_company_id_scheme,
            ]
        );

        return Reply::success(__('messages.updateSuccess'));
    }

    public function clientModal($id)
    {
        $this->clientDetails = ClientDetails::findOrFail($id);

        return view('einvoice::client.modal', $this->data);
    }

    public function clientSave(Request $request, $id)
    {
        $clientDetails = ClientDetails::findOrFail($id);
        $clientDetails->electronic_address = $request->electronic_address;
        $clientDetails->electronic_address_scheme = $request->electronic_address_scheme;
        $clientDetails->saveQuietly();

        return Reply::success(__('messages.updateSuccess'));
    }

}

{{-- Meeting Summary Modal --}}
<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">📝 {{ $summary['meetingType']['name'] ?? ('Meeting Summary for ' . ($summary['deal']['name'] ?? 'N/A')) }} </h5>
    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    @if($errors->any())
        <div class="alert alert-danger" role="alert">
            {{ $errors->first('error') }}
        </div>
    @else
    <div class="meeting-summary" style="font-size: 16px; padding: 0 7px;">
    {{-- Meeting Information --}}
    <h4 style="font-size: 20px; margin-bottom: 15px;">Meeting Information</h4>
    <hr>
    
    <p style="margin-bottom: 10px;"><strong>Deal:</strong> 
        @if(isset($summary['deal']) && $summary['deal'])
            {{ $summary['deal']['name'] ?? 'N/A' }}
        @else
            Not linked
        @endif
    </p>
    
    <p style="margin-bottom: 20px;"><strong>Meeting Type:</strong> 
        @if(isset($summary['meetingType']) && $summary['meetingType'])
            {{ $summary['meetingType']['name'] ?? 'N/A' }}
        @else
            Not specified
        @endif
    </p>

    {{-- Summary Content --}}
    @if(isset($summary['summary_object']) && $summary['summary_object'] !== null && $summary['summary_object'] !== '')
        <h4 style="font-size: 20px; margin-bottom: 15px;">Meeting Summary </h4>
        <hr>
        
        @if(is_array($summary['summary_object']) || is_object($summary['summary_object']))
            {{-- Render object/array as formatted content with custom ordering --}}
            @php 
                $orderedSections = [
                    'executive_summary' => 'Executive Summary',
                    'key_points_discussed' => 'Key Points Discussed',
                    'action_points' => 'Action Points',
                    'sales_objections' => 'Sales Objections',
                    'recommendations' => 'Recommendations'
                ];
                
                $processedSections = [];
                
                // Helper function to find section key regardless of format (underscore vs space)
                $findSectionKey = function($targetKey, $data) {
                    $variations = [
                        $targetKey,
                        str_replace('_', ' ', $targetKey),
                        str_replace(' ', '_', $targetKey)
                    ];
                    foreach ($variations as $variation) {
                        if (isset($data[$variation])) {
                            return $variation;
                        }
                    }
                    return null;
                };
            @endphp
            
            {{-- First, process sections in the desired order --}}
            @foreach($orderedSections as $sectionKey => $sectionTitle)
                @php $actualKey = $findSectionKey($sectionKey, $summary['summary_object']); @endphp
                @if($actualKey)
                    @php $processedSections[$actualKey] = $summary['summary_object'][$actualKey]; @endphp
                @endif
            @endforeach
            
            {{-- Then process any remaining sections not in the ordered list --}}
            @foreach($summary['summary_object'] as $key => $value)
                @if(!isset($processedSections[$key]))
                    @php $processedSections[$key] = $value; @endphp
                @endif
            @endforeach
            
            {{-- Display sections in order --}}
            @foreach($processedSections as $key => $value)
                @php 
                    // Find the display title by matching the key to our ordered sections
                    $displayTitle = ucwords(str_replace('_', ' ', $key));
                    foreach($orderedSections as $sectionKey => $sectionTitle) {
                        if ($key === $sectionKey || $key === str_replace('_', ' ', $sectionKey) || $key === str_replace(' ', '_', $sectionKey)) {
                            $displayTitle = $sectionTitle;
                            break;
                        }
                    }
                @endphp
                <div style="margin-bottom: 20px; margin-top: 20px; padding: 0 5px;">
                    <p style="margin-bottom: 10px; margin-top: 20px;"><strong>{{ $displayTitle }}:</strong></p>
                    @if(is_array($value) || is_object($value))
                        @php $subCounter = 1; @endphp
                        @foreach($value as $subKey => $subValue)
                            @php 
                                // Clean the sub-key to remove numeric prefixes and colons
                                
                                // Remove numeric prefixes like "0: ", "1: ", "2: ", etc.
                                $cleanSubKey = $subKey;
                                
                                // More comprehensive cleaning - try multiple approaches
                                // First, remove any leading number followed by colon and space
                                $cleanSubKey = preg_replace('/^\d+\s*:\s*/', '', $cleanSubKey);
                                
                                // Remove just leading colon and space
                                $cleanSubKey = preg_replace('/^:\s*/', '', $cleanSubKey);
                                
                                // Remove leading spaces
                                $cleanSubKey = ltrim($cleanSubKey);
                                
                                // If the key is empty or just whitespace after cleaning, use the value
                                if (empty(trim($cleanSubKey))) {
                                    $cleanSubKey = $subValue ?? 'Item';
                                }
                                
                                // Also handle cases where the key might be just a number
                                if (is_numeric(trim($cleanSubKey))) {
                                    // If the key is just a number, use the value as the key
                                    $cleanSubKey = $subValue ?? 'Item';
                                }
                                
                                $displaySubKey = ucwords(str_replace('_', ' ', $cleanSubKey));
                            @endphp
                            <div style="text-align: justify; margin-bottom: 8px; padding-left: 7px;">
                                <strong>{{ $subCounter }}.</strong> {{ $displaySubKey }}
                            </div>
                            @php $subCounter++; @endphp
                        @endforeach
                    @else
                        <p style="margin-bottom: 15px; padding-left: 10px;">{{ $value ?? 'Not specified' }}</p>
                    @endif
                </div>
            @endforeach
        @else
            {{-- Render string content --}}
            <p>{{ $summary['summary_object'] }}</p>
        @endif
    @else
        <p><em>No meeting summary has been generated for this meeting yet.</em></p>
    @endif
    </div>
    @endif
</div>
<div class="modal-footer">
    <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
</div>

<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; }
    .page { page-break-after: always; width: 100%; min-height: 100vh; position: relative; }
    .page:last-child { page-break-after: auto; }
    .hero-grid { display: grid; gap: 10px; min-height: 500px; }
    .hero-grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    .hero-grid-3 { grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; }
    .hero-grid-2 { grid-template-columns: 1fr 1fr; }
    .hero-grid-1 { grid-template-columns: 1fr; }
    .img-cover { width: 100%; height: 100%; object-fit: cover; }
    .text-center { text-align: center; }
</style>

<!-- Page 1: Hero Page -->
<div class="page">
    <!-- Top Section: Agent Info -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center;">
        <p style="font-size: 12px; opacity: 0.8; margin-bottom: 20px;">{{ $data['created_at'] }}</p>
        <h1 style="font-size: 42px; margin-bottom: 20px; font-weight: 300; letter-spacing: 1px;">
            Hello! This is what we found for you
        </h1>
        
        <div style="display: inline-flex; align-items: center; gap: 20px; margin-top: 30px; background: rgba(255,255,255,0.1); padding: 20px 40px; border-radius: 50px;">
            @if(isset($data['agent']['image']))
                <img src="{{ $data['agent']['image'] }}" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid white;">
            @else
                <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold;">
                    {{ substr($data['agent']['name'], 0, 1) }}
                </div>
            @endif
            <div style="text-align: left;">
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">{{ $data['agent']['name'] }}</p>
                <p style="font-size: 13px; opacity: 0.9;">📧 {{ $data['agent']['email'] }}</p>
                <p style="font-size: 13px; opacity: 0.9;">📱 {{ $data['agent']['phone'] }}</p>
            </div>
        </div>
    </div>

    <!-- Hero Images -->
    <div style="padding: 20px;">
        @php
            $heroImages = $data['assets']['hero'] ?? [];
            $count = count($heroImages);
        @endphp
        
        @if($count >= 4)
            <div class="hero-grid hero-grid-4">
                @foreach(array_slice($heroImages, 0, 4) as $image)
                    <img src="{{ $image }}" class="img-cover" style="border-radius: 8px;">
                @endforeach
            </div>
        @elseif($count == 3)
            <div class="hero-grid hero-grid-3">
                <img src="{{ $heroImages[0] }}" class="img-cover" style="grid-row: span 2; border-radius: 8px;">
                <img src="{{ $heroImages[1] }}" class="img-cover" style="border-radius: 8px;">
                <img src="{{ $heroImages[2] }}" class="img-cover" style="border-radius: 8px;">
            </div>
        @elseif($count == 2)
            <div class="hero-grid hero-grid-2">
                <img src="{{ $heroImages[0] }}" class="img-cover" style="border-radius: 8px;">
                <img src="{{ $heroImages[1] }}" class="img-cover" style="border-radius: 8px;">
            </div>
        @elseif($count == 1)
            <div class="hero-grid hero-grid-1">
                <img src="{{ $heroImages[0] }}" class="img-cover" style="border-radius: 8px;">
            </div>
        @else
            <div style="height: 400px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #999; border-radius: 8px;">
                <p>No hero images available</p>
            </div>
        @endif
    </div>
</div>

<!-- Page 2: Property Details -->
<div class="page" style="padding: 60px;">
    <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 48px; color: #2c3e50; margin-bottom: 10px;">{{ $data['title'] }}</h1>
        <p style="font-size: 20px; color: #7f8c8d;">📍 {{ $data['address'] }}</p>
    </div>

    <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 15px; margin-bottom: 50px;">
        <p style="font-size: 18px; opacity: 0.9; margin-bottom: 5px;">Price</p>
        <h2 style="font-size: 56px; font-weight: bold;">{{ $data['price'] }}</h2>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 30px; justify-content: center; margin-bottom: 40px;">
        <div style="text-align: center; min-width: 200px; padding: 25px; background: #f8f9fa; border-radius: 10px; border-top: 4px solid #667eea;">
            <p style="font-size: 14px; color: #7f8c8d; margin-bottom: 8px; text-transform: uppercase;">Area</p>
            <p style="font-size: 28px; font-weight: bold; color: #2c3e50;">{{ $data['area'] ?? 'N/A' }} m²</p>
        </div>
        <div style="text-align: center; min-width: 200px; padding: 25px; background: #f8f9fa; border-radius: 10px; border-top: 4px solid #764ba2;">
            <p style="font-size: 14px; color: #7f8c8d; margin-bottom: 8px; text-transform: uppercase;">Property Type</p>
            <p style="font-size: 28px; font-weight: bold; color: #2c3e50;">{{ $data['property_type'] ?? 'N/A' }}</p>
        </div>
        <div style="text-align: center; min-width: 200px; padding: 25px; background: #f8f9fa; border-radius: 10px; border-top: 4px solid #667eea;">
            <p style="font-size: 14px; color: #7f8c8d; margin-bottom: 8px; text-transform: uppercase;">Bathrooms</p>
            <p style="font-size: 28px; font-weight: bold; color: #2c3e50;">{{ $data['bathrooms'] ?? 'N/A' }}</p>
        </div>
        <div style="text-align: center; min-width: 200px; padding: 25px; background: #f8f9fa; border-radius: 10px; border-top: 4px solid #764ba2;">
            <p style="font-size: 14px; color: #7f8c8d; margin-bottom: 8px; text-transform: uppercase;">Building Age</p>
            <p style="font-size: 28px; font-weight: bold; color: #2c3e50;">{{ $data['building_age'] ?? 'N/A' }} years</p>
        </div>
    </div>

    @if(!empty($data['assets']['area']) && count($data['assets']['area']) > 0)
        <div style="text-align: center;">
            <img src="{{ $data['assets']['area'][0] }}" style="max-width: 80%; max-height: 400px; object-fit: cover; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
        </div>
    @endif
</div>

<!-- Page 3: Exterior Images -->
<div class="page" style="padding: 60px;">
    <h2 style="font-size: 42px; color: #2c3e50; margin-bottom: 40px; text-align: center; position: relative;">
        <span style="background: white; padding: 0 30px; position: relative; z-index: 1;">Exterior Images</span>
        <span style="position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #667eea, transparent);"></span>
    </h2>
    @php
        $exteriorImages = $data['assets']['exterior'] ?? [];
    @endphp
    @if(count($exteriorImages) > 0)
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            @foreach(array_slice($exteriorImages, 0, 6) as $image)
                <img src="{{ $image }}" style="width: 100%; height: 350px; object-fit: cover; border-radius: 10px;">
            @endforeach
        </div>
    @else
        <p class="text-center" style="color: #999; margin-top: 100px; font-size: 18px;">No exterior images available</p>
    @endif
</div>

<!-- Page 4: Interior Images -->
<div class="page" style="padding: 60px;">
    <h2 style="font-size: 42px; color: #2c3e50; margin-bottom: 40px; text-align: center; position: relative;">
        <span style="background: white; padding: 0 30px; position: relative; z-index: 1;">Interior Images</span>
        <span style="position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #667eea, transparent);"></span>
    </h2>
    @php
        $interiorImages = $data['assets']['interior'] ?? [];
    @endphp
    @if(count($interiorImages) > 0)
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            @foreach(array_slice($interiorImages, 0, 6) as $image)
                <img src="{{ $image }}" style="width: 100%; height: 350px; object-fit: cover; border-radius: 10px;">
            @endforeach
        </div>
    @else
        <p class="text-center" style="color: #999; margin-top: 100px; font-size: 18px;">No interior images available</p>
    @endif
</div>

<!-- Page 5: Floor Plan -->
<div class="page" style="padding: 60px;">
    <h2 style="font-size: 42px; color: #2c3e50; margin-bottom: 40px; text-align: center; position: relative;">
        <span style="background: white; padding: 0 30px; position: relative; z-index: 1;">Floor Plan</span>
        <span style="position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #667eea, transparent);"></span>
    </h2>
    @php
        $floorPlanImages = $data['assets']['floor-plan'] ?? [];
    @endphp
    @if(count($floorPlanImages) > 0)
        <div style="display: grid; grid-template-columns: repeat(1, 1fr); gap: 30px;">
            @foreach(array_slice($floorPlanImages, 0, 2) as $image)
                <img src="{{ $image }}" style="width: 100%; max-height: 500px; object-fit: contain; background: #f9f9f9; padding: 30px; border-radius: 10px;">
            @endforeach
        </div>
    @else
        <p class="text-center" style="color: #999; margin-top: 100px; font-size: 18px;">No floor plan available</p>
    @endif
</div>

<!-- Page 6: Facilities -->
<div class="page" style="padding: 60px;">
    <h2 style="font-size: 42px; color: #2c3e50; margin-bottom: 40px; text-align: center; position: relative;">
        <span style="background: white; padding: 0 30px; position: relative; z-index: 1;">Facilities</span>
        <span style="position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #667eea, transparent);"></span>
    </h2>
    
    <div style="columns: 2; column-gap: 40px;">
        @if(!empty($data['exterior_features']))
            @foreach($data['exterior_features'] as $feature)
                <div style="break-inside: avoid; margin-bottom: 15px; padding: 15px 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                    <p style="font-size: 16px; color: #2c3e50;">✓ {{ $feature }}</p>
                </div>
            @endforeach
        @endif
        @if(!empty($data['interior_features']))
            @foreach($data['interior_features'] as $feature)
                <div style="break-inside: avoid; margin-bottom: 15px; padding: 15px 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #764ba2;">
                    <p style="font-size: 16px; color: #2c3e50;">✓ {{ $feature }}</p>
                </div>
            @endforeach
        @endif
        @if(!empty($data['location_features']))
            @foreach($data['location_features'] as $feature)
                <div style="break-inside: avoid; margin-bottom: 15px; padding: 15px 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #f093fb;">
                    <p style="font-size: 16px; color: #2c3e50;">✓ {{ $feature }}</p>
                </div>
            @endforeach
        @endif
    </div>
</div>

<!-- Page 7: About the Property -->
<div class="page" style="padding: 60px;">
    <h2 style="font-size: 42px; color: #2c3e50; margin-bottom: 40px; text-align: center; position: relative;">
        <span style="background: white; padding: 0 30px; position: relative; z-index: 1;">About the Property</span>
        <span style="position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #667eea, transparent);"></span>
    </h2>
    
    <div style="max-width: 800px; margin: 0 auto; line-height: 2; font-size: 16px; color: #34495e; text-align: justify;">
        {!! $data['description'] ?? '<p style="color: #999; text-align: center;">No description available</p>' !!}
    </div>
</div>

<!-- Page 8: Footer & Contact -->
<div class="page" style="padding: 0;">
    @php
        $footerImages = $data['assets']['footer'] ?? [];
    @endphp
    @if(count($footerImages) > 0)
        <div style="height: 40vh; overflow: hidden;">
            <img src="{{ $footerImages[0] }}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
    @else
        <div style="height: 40vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
    @endif
    
    <div style="background: #2c3e50; color: white; padding: 60px; text-align: center;">
        <h2 style="font-size: 36px; margin-bottom: 30px;">If you have any questions,<br>you can contact us</h2>
        
        <div style="display: inline-flex; align-items: center; gap: 30px; margin-top: 30px; padding: 30px; background: rgba(255,255,255,0.1); border-radius: 15px;">
            @if(isset($data['agent']['image']))
                <img src="{{ $data['agent']['image'] }}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid white;">
            @else
                <div style="width: 100px; height: 100px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: bold;">
                    {{ substr($data['agent']['name'], 0, 1) }}
                </div>
            @endif
            <div style="text-align: left;">
                <p style="font-size: 28px; font-weight: bold; margin-bottom: 10px;">{{ $data['agent']['name'] }}</p>
                <p style="font-size: 16px; opacity: 0.9; margin-bottom: 8px;">📧 {{ $data['agent']['email'] }}</p>
                <p style="font-size: 16px; opacity: 0.9;">📱 {{ $data['agent']['phone'] }}</p>
            </div>
        </div>

        @if(isset($data['company']['logo']))
            <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.2);">
                <img src="{{ $data['company']['logo'] }}" style="max-width: 200px; opacity: 0.8;">
            </div>
        @endif
    </div>
</div>

# Deal Import - Stage Configuration Guide

## ✅ Changes Implemented

### Import Fields Updated (`DealImport.php`)
- ✅ Added `stage_id` field (Stage ID)
- ✅ Added `deal_stage` field (Deal Stage Name) 
- ❌ Removed `pipeline` field (no longer needed)

### Job Logic Updated (`ImportDealJob.php`)
- ✅ Removed `pipeline` from required fields validation
- ✅ Implemented 3-tier stage lookup with fallback
- ✅ All lookups are cached for performance
- ✅ Stage lookups automatically get pipeline ID

---

## 📋 Import Options

### Option 1: Import with Stage ID (Recommended)
**Best for:** Multiple pipelines with duplicate stage names

```csv
deal_name,lead_contact_email,stage_id,deal_value,close_date
"Enterprise Deal",client@company.com,42,100000,2025-12-01
"Small Deal",another@company.com,42,5000,2025-11-15
```

**How it works:**
- Direct lookup by stage ID
- No ambiguity
- Works across all pipelines

---

### Option 2: Import with Stage Name
**Best for:** Simple setups, unique stage names

```csv
deal_name,lead_contact_email,deal_stage,deal_value,close_date
"Enterprise Deal",client@company.com,"Qualified",100000,2025-12-01
"Small Deal",another@company.com,"Proposal",5000,2025-11-15
```

**How it works:**
- Looks up stage by name
- Uses first match if multiple stages have same name
- Automatically gets the correct pipeline

---

### Option 3: Import with Default Stage
**Best for:** Bulk imports where all deals start at same stage

```csv
deal_name,lead_contact_email,deal_value,close_date
"Enterprise Deal",client@company.com,100000,2025-12-01
"Small Deal",another@company.com,5000,2025-11-15
```

**How it works:**
- No stage info provided
- Uses first stage of first pipeline
- Good for initial lead imports

---

## 🎯 Priority Logic

The system checks in this order:

1. **`stage_id`** - If provided and exists → Use it ✅
2. **`deal_stage`** - If provided and exists → Use it ✅  
3. **Default** - Use first stage of first pipeline ✅
4. **None found** - Import fails with error ❌

---

## 📊 Example Excel/CSV Files

### Full Import (All Optional Fields)
```csv
deal_name,lead_contact_email,stage_id,deal_stage,deal_value,close_date,responsible_name
"Big Deal",john@company.com,42,"Qualified",50000,2025-12-01,"John Doe"
"Medium Deal",jane@company.com,,"Proposal",25000,2025-11-15,"Jane Smith"
"Small Deal",bob@company.com,,,5000,2025-11-30,
```

**Row 1:** Uses stage_id=42  
**Row 2:** Uses stage name "Proposal"  
**Row 3:** Uses default stage

---

## 🔍 How to Find Stage IDs

### Method 1: Database Query
```sql
SELECT 
    ps.id as stage_id,
    ps.name as stage_name,
    lp.name as pipeline_name,
    lp.company_id
FROM pipeline_stages ps
JOIN lead_pipelines lp ON ps.lead_pipeline_id = lp.id
WHERE lp.company_id = YOUR_COMPANY_ID
ORDER BY lp.id, ps.id;
```

### Method 2: Laravel Tinker
```php
php artisan tinker

// Get all stages for your company
$stages = \App\Models\PipelineStage::whereHas('pipeline', function($q) {
    $q->where('company_id', 1); // Your company ID
})->with('pipeline')->get();

foreach($stages as $stage) {
    echo "ID: {$stage->id} | Stage: {$stage->name} | Pipeline: {$stage->pipeline->name}\n";
}
```

### Method 3: Export Current Deals
Export your existing deals and check their stage_id values.

---

## ⚙️ Required Fields

### Minimum Required:
- ✅ `deal_name`
- ✅ `lead_contact_email`
- ✅ `deal_value`
- ✅ `close_date`

### Optional Fields:
- `stage_id` - Pipeline Stage ID
- `deal_stage` - Pipeline Stage Name
- `responsible_name` - Agent name or email
- Marketing fields (UTM, etc.)
- Custom fields (dynamic)

---

## 🚀 Performance Features

All stage lookups are cached:
- ✅ `getStageById()` - Cached by company + stage_id
- ✅ `getStageByName()` - Cached by company + stage_name
- ✅ `getDefaultStage()` - Cached by company
- ✅ Pipeline info automatically included

**Result:** After first lookup, subsequent rows with same stage are instant!

---

## 🐛 Troubleshooting

### "No valid stage found and no default stage available"
**Cause:** No stages exist in any pipeline for your company  
**Fix:** Create at least one pipeline with one stage

### Stage not being mapped correctly
**Cause:** Multiple stages with same name  
**Fix:** Use `stage_id` instead of `deal_stage` name

### Import using wrong stage
**Cause:** Stage name matches first pipeline, not intended one  
**Fix:** Use `stage_id` for precision

---

## 📝 Import Template

Create a CSV with these headers:

```csv
deal_name,lead_contact_email,stage_id,deal_value,close_date,responsible_name
```

Or with stage name instead:

```csv
deal_name,lead_contact_email,deal_stage,deal_value,close_date,responsible_name
```

Or minimal version:

```csv
deal_name,lead_contact_email,deal_value,close_date
```

---

## ✅ Ready to Import!

The system is now configured to accept:
1. Stage ID (most precise)
2. Stage name (convenient)
3. No stage (uses default)

All with optimized caching and performance! 🎯


# Deal Import with Pipeline Selection

## ✅ How It Works Now

### 1. User Selects Pipeline in Import View
- Dropdown shows all pipelines for the company
- User selects which pipeline ALL deals should be imported to
- Optional: Leave blank to use first pipeline as default

### 2. CSV File Contains Stage Names
```csv
deal_name,lead_contact_email,deal_stage,deal_value,close_date
"Big Deal",client@example.com,"Qualified",50000,2025-12-01
"Medium Deal",client2@example.com,"Proposal",25000,2025-11-15
"Small Deal",client3@example.com,,5000,2025-11-30
```

### 3. Import Logic (Automatic)
**For each deal:**

1. **If `deal_stage` provided** → Look up stage by name in selected pipeline
2. **If stage not found or blank** → Use first stage of selected pipeline
3. **Create deal** with correct pipeline_id and stage_id

---

## 📊 Example Scenario

### Setup:
- **Pipeline Selected:** "Sales Pipeline" (ID: 5)
- **Stages in Sales Pipeline:** 
  - Lead (ID: 10)
  - Qualified (ID: 11)
  - Proposal (ID: 12)
  - Closed Won (ID: 13)

### CSV Data:
```csv
deal_name,deal_stage
"Deal A","Qualified"
"Deal B","Proposal"  
"Deal C",""
```

### Result:
- **Deal A** → Pipeline: 5, Stage: 11 (Qualified)
- **Deal B** → Pipeline: 5, Stage: 12 (Proposal)
- **Deal C** → Pipeline: 5, Stage: 10 (Lead - first stage)

---

## 🎯 Benefits

1. **Simple CSV** - Users only need to provide stage names, not IDs
2. **No Ambiguity** - Pipeline selected in UI ensures correct stage lookup
3. **Bulk Assignment** - All deals go to same pipeline in one import
4. **Fallback Safe** - Missing stages default to first stage of pipeline
5. **Cached Lookups** - Performance optimized for large imports

---

## 📋 CSV Template

### Minimum Required:
```csv
deal_name,lead_contact_email,deal_value,close_date
```

### With Stage:
```csv
deal_name,lead_contact_email,deal_stage,deal_value,close_date
```

### Full Import:
```csv
deal_name,lead_contact_email,deal_stage,deal_value,close_date,responsible_name
"Enterprise Deal",john@company.com,"Qualified",100000,2025-12-01,"Jane Smith"
```

---

## ⚠️ Important Notes

1. **Stage names must match exactly** - Case-sensitive
2. **All deals import to same pipeline** - Can't mix pipelines in one import
3. **Pipeline selection is optional** - Defaults to first pipeline if not selected
4. **Stage is optional** - Defaults to first stage if not provided

---

## 🚀 Import Flow

```
User Action → Select Pipeline (e.g., "Sales Pipeline")
              Upload CSV with stage names
              Click Upload
                    ↓
System      → Read pipeline_id from form (e.g., 5)
              For each row in CSV:
                - Look up stage "Qualified" in pipeline 5
                - Create deal with pipeline_id=5, stage_id=11
                    ↓
Result      → All deals imported to "Sales Pipeline"
              Each deal in correct stage
```

---

## 🔍 Stage Lookup Priority

For each deal, system checks in order:

1. **deal_stage name in CSV** + **selected pipeline** → Use this stage ✅
2. **No stage or not found** → Use first stage of selected pipeline ✅
3. **No pipeline selected** → Use first stage of first pipeline ✅

---

## ✅ Ready!

The import now works with:
- Pipeline selection in UI
- Simple stage names in CSV
- Automatic stage lookup within selected pipeline
- Optimized with caching for performance


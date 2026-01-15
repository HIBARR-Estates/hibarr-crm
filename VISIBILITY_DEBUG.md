# Custom Field Visibility Debug Guide

## How Visibility Works

Each custom field has its **own independent visibility rules**. When a field's hide condition is met, it should **only hide that specific field**, not other fields.

## Expected Behavior

- **Field A** with hide rule → When condition met → Only Field A is hidden
- **Field B** (no rules) → Always visible (unless it has its own rules)
- **Field C** with show rule → When condition met → Field C is shown

## Current Implementation

1. Each field's visibility is evaluated independently in `evaluateAllFieldsVisibility()`
2. The visibility map returns: `{ fieldId: true/false }` for each field
3. Each field checks its own visibility before rendering

## Debugging Steps

If you're seeing fields below a hidden field also disappear, check:

1. **Do those fields have their own visibility rules?**
   - Check if Fields B, C, D have visibility rules configured
   - If they do, their rules might be hiding them

2. **Are the field IDs correct?**
   - Make sure each field has a unique ID
   - Check the browser console for any errors

3. **Check the visibility map:**
   - Add this to see what's happening:
   ```javascript
   console.log('Visibility Map:', visibilityMap);
   ```

4. **Layout Issue?**
   - Check if it's a CSS/layout problem
   - Hidden fields might be causing layout shifts

## Common Issues

### Issue: "Hide condition hides all fields below"
**Possible Causes:**
- All fields share the same visibility rule (check field IDs)
- CSS issue causing layout collapse
- React key issue causing re-rendering problems

### Solution:
- Verify each field has unique rules
- Check browser DevTools to see if fields are actually rendered but hidden by CSS
- Verify field IDs are unique


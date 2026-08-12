# Product Data Access API Documentation

## Overview
This document explains how to access the `product.name` and other product data from the selected model in the str dropdown list.

## How It Works

### Flow Diagram
```
1. User selects a CWA folder
   ↓
2. System fetches all IFC files and stores in modelItemsById map
   ↓
3. User selects a model from the "Model No" dropdown
   ↓
4. loadModelDetails() function is called with:
   - itemId: The selected model's ID
   - requestId: Request tracking ID
   - selectedItem: The item object from modelItemsById (if available)
   ↓
5. extractStrName() searches for product.name in multiple locations:
   - item.product.name (preferred)
   - item.product.productName
   - item.productName
   - item.latestVersion.product.name
   - etc. (see code for full list)
   ↓
6. If not found in selectedItem, API call is made to fetch full item details
   ↓
7. setSelectedProductData() is called to store the data globally
   ↓
8. selectedProductData object now contains:
   {
     itemId: "string",
     name: "string (Product Name)",
     description: "string (Product Description)",
     fullItemData: Object,
     selectedAt: "ISO timestamp"
   }
   ↓
9. Data is available via window.TrimbleProductAPI
```

## Accessing Product Data

### Method 1: JavaScript Console (Testing/Debugging)
```javascript
// Get all selected product data
const productData = window.TrimbleProductAPI.getSelectedProduct();
console.log(productData);
// Output:
// {
//   itemId: "abc123",
//   name: "Product Name from Trimble Connect",
//   description: "Product Description",
//   fullItemData: {...},
//   selectedAt: "2026-08-12T10:30:00.000Z"
// }

// Get only the product name
const productName = window.TrimbleProductAPI.getProductName();
console.log(productName); // "Product Name from Trimble Connect"

// Get only the selected item ID
const itemId = window.TrimbleProductAPI.getSelectedItemId();
console.log(itemId); // "abc123"
```

### Method 2: In Your Code
```javascript
// Access the selected product data
function handleSelectedProduct() {
    const product = window.TrimbleProductAPI.getSelectedProduct();
    
    if (product.name) {
        console.log(`Selected: ${product.name}`);
        // Do something with the product data
        sendToServer(product);
    } else {
        console.log("No product selected yet");
    }
}
```

### Method 3: Direct Global Access (Advanced)
```javascript
// If you need raw access
const selectedData = selectedProductData; // Defined in app.js
console.log(selectedData.name);
```

## Where product.name Comes From

The code searches for `product.name` in this priority order:

1. **Direct Properties**
   - `item.product.name` ✓ (Most common in Trimble Connect API)
   - `item.product.productName`
   - `item.productName`

2. **Nested in Properties Object**
   - `item.properties["Product Name"]`
   - `item.properties["product name"]`
   - `item.properties.productName`

3. **In Metadata**
   - `item.metadata.product.name`
   - `item.metadata.productName`

4. **In Data Object**
   - `item.data.product.name`
   - `item.data.product.productName`
   - `item.data.productName`

5. **In Latest Version** (if not found above)
   - Fetches `/items/{itemId}/versions` API
   - Checks `latest.product.name`
   - If still not found, fetches full version details

## Code Changes Summary

### Global Variables Added
```javascript
let selectedProductData = null; // Stores the currently selected product details
```

### Functions Added
```javascript
// Get the currently selected product data
function getSelectedProductData()

// Set and store the selected product data
function setSelectedProductData(itemId, productName, productDescription, fullItemData)
```

### Public API Added
```javascript
window.TrimbleProductAPI = {
    getSelectedProduct(),     // Returns full product data object
    getProductName(),         // Returns just the product name string
    getSelectedItemId()       // Returns just the item ID
}
```

### Functions Modified
- `loadModelDetails()` - Now calls `setSelectedProductData()` when product is loaded
- Early return path - Now saves data even when product found in selectedItem

## Example: Full Workflow

```html
<!-- HTML -->
<button id="exportBtn">Export Selected Product</button>

<script>
// Listen for product selection changes
document.getElementById("exportBtn").addEventListener("click", () => {
    const product = window.TrimbleProductAPI.getSelectedProduct();
    
    if (!product.itemId) {
        alert("Please select a product first");
        return;
    }
    
    // Now you have:
    // - product.name: "Steel Beam ABC-123"
    // - product.description: "High-quality structural steel"
    // - product.itemId: "item-xyz-789"
    // - product.selectedAt: "2026-08-12T10:30:00.000Z"
    // - product.fullItemData: Complete API response object
    
    // Export to your system
    fetch("/api/export-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product)
    });
});
</script>
```

## Troubleshooting

### "No product selected yet" or empty name
- **Cause**: User hasn't selected a model yet, OR product.name doesn't exist in API response
- **Fix**: Wait for user to select, or check API response with developer tools

### Product name shows "(Product Name not available)"
- **Cause**: API didn't return product.name in any expected location
- **Fix**: Check the console for "Product Name:" logs to see what was returned from Trimble Connect

### window.TrimbleProductAPI is undefined
- **Cause**: app.js hasn't loaded yet or there's a script error
- **Fix**: Check browser console for errors, ensure app.js loads before using the API

## Debug Logging

The code automatically logs when product data is updated:
```javascript
console.log("Selected product data updated:", selectedProductData);
```

Open Developer Tools (F12) and check the Console tab to see this output whenever a product is selected.

## Next Steps

You can now use the product data to:
- Export to external systems
- Send to backend server
- Display in custom UI panels
- Integrate with other extensions
- Generate reports
- Track usage analytics

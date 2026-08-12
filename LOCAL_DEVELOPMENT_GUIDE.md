# Local Development & Testing Guide
## Trimble Extension - Development Workflow

---

## 🚀 Part 1: Local Development Setup

### Option A: Using Node.js HTTP Server (Recommended - Easiest)

#### Step 1: Install Node.js
1. Download from: https://nodejs.org/ (LTS version recommended)
2. Install it
3. Verify installation:
```bash
node --version
npm --version
```

#### Step 2: Start Local Server
Navigate to your project folder and run:

```bash
# Using built-in npm package (no installation needed)
npx http-server -p 8080 -c-1

# OR if you prefer a specific package
npm install -g http-server
http-server -p 8080 -c-1
```

**Parameters explained:**
- `-p 8080` → Port number (you can use 3000, 5000, 8000, etc.)
- `-c-1` → Disables caching (important for development)

**Output will show:**
```
Starting up http-server, serving .
Hit CTRL-C to stop the server
http://127.0.0.1:8080

Available on:
  http://127.0.0.1:8080
```

---

### Option B: Using Python (If You Have Python Installed)

**Python 3:**
```bash
python -m http.server 8080
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8080
```

---

### Option C: Using Visual Studio Code Built-in Server

1. Install extension: **"Live Server"** (by Ritwick Dey)
2. Right-click `index.html` → **"Open with Live Server"**
3. Browser opens at `http://127.0.0.1:5500/`
4. Auto-reloads on file changes

---

## 📋 Part 2: Configure for Local Testing

### Step 1: Update Your Extension URL

Edit `extension-manifest.json`:

```json
{
  "icon": "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg",
  "title": "My Trimble Extension",
  "url": "http://localhost:8080/",  // ← CHANGE THIS
  "description": "Trimble Connect project extension page for custom UI and menu actions",
  "configCommand": "my_trimble_extension_config",
  "permissions": [
    "accesstoken",
    "projects"
  ],
  "enabled": true
}
```

### Step 2: Host the Manifest File Locally

Trimble Connect needs to access your manifest. Two options:

**Option A: Serve from same local server**
- URL: `http://localhost:8080/extension-manifest.json`

**Option B: Use a tunnel service (ngrok)**
```bash
# Install ngrok from: https://ngrok.com/
ngrok http 8080

# Output:
# Forwarding                    https://xxxx-xx-xxx-xxxx-x.ngrok.io -> http://localhost:8080
```

Then use the ngrok URL in Trimble Connect.

---

## 🧪 Part 3: Testing Your Extension Locally

### Method 1: Direct HTML Testing (No Trimble Connect Needed)

Open `index.html` directly in your browser:

```
file:///D:/api Develop/MyTrimbleExtension/index.html
```

**Limitations:**
- Won't have Trimble Connect API available
- Can't test real product selection
- Good for UI/styling testing

---

### Method 2: Using the Test Suite

Open `TEST_PRODUCT_API.html` in your browser:

```
http://localhost:8080/TEST_PRODUCT_API.html
```

**Tests included:**
- ✅ Product data storage
- ✅ API methods
- ✅ Data extraction
- ✅ Edge cases
- ✅ Performance

---

### Method 3: Console Testing

1. Open your local server: `http://localhost:8080`
2. Open DevTools: **F12**
3. Go to **Console** tab
4. Test your functions:

```javascript
// Test helper functions
getSelectedProductData()
window.TrimbleProductAPI

// Simulate product selection
setSelectedProductData("test-123", "Test Product", "Test Description", {})
getSelectedProductData()

// Test API
window.TrimbleProductAPI.getProductName()
window.TrimbleProductAPI.getSelectedItemId()
```

---

### Method 4: Full Testing with Trimble Connect (Production-like)

This is how you test with actual Trimble Connect:

#### Prerequisites:
- Trimble Connect account
- Access to your office's Trimble Connect instance
- Project with models

#### Steps:

1. **Start your local server:**
```bash
npx http-server -p 8080 -c-1
```

2. **Make your extension accessible from office network:**

   **Option A: Use ngrok (Recommended)**
   ```bash
   ngrok http 8080
   # Copy the URL: https://xxxx-xx-xxx-xxxx-x.ngrok.io
   ```

   **Option B: Use your machine's local IP**
   ```bash
   ipconfig  # Find your IPv4 Address (e.g., 192.168.1.100)
   # Access via: http://192.168.1.100:8080
   ```

3. **Update extension manifest:**
   ```json
   "url": "https://xxxx-xx-xxx-xxxx-x.ngrok.io/",
   ```

4. **Register extension in Trimble Connect:**
   - Go to Admin → Extensions
   - Add extension
   - Paste manifest URL: `https://xxxx-xx-xxx-xxxx-x.ngrok.io/extension-manifest.json`
   - Enable it

5. **Test in Trimble Connect:**
   - Open a project
   - Your extension should appear
   - Select a model
   - Check DevTools console for logs

---

## 🔧 Part 4: Development Tools & Debugging

### A. Browser DevTools (F12)

**Console Tab:**
```javascript
// Check if API is loaded
console.log(window.TrimbleConnectWorkspace)
console.log(window.TrimbleProductAPI)

// View current product data
console.log(selectedProductData)

// Test functions
window.TrimbleProductAPI.getSelectedProduct()
```

**Network Tab:**
- Monitor API calls to Trimble Connect
- Check for CORS errors
- Verify response data

**Sources Tab:**
- Set breakpoints in your code
- Debug step-by-step
- Inspect variables

---

### B. Live Reload with Watch

#### Using Node.js with nodemon:

```bash
# Install nodemon
npm install -g nodemon

# Start with auto-reload
nodemon --watch . --ext html,js,css --exec "npx http-server -p 8080 -c-1"
```

#### Using Live Server extension in VS Code:
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"
4. Changes auto-reload!

---

### C. Logging & Debugging

Add this to `app.js` for better debugging:

```javascript
// Add at the top of app.js
const DEBUG = true;

function log(message, data) {
    if (DEBUG) {
        console.log(`[TrimbleExt] ${message}`, data);
    }
}

// Use throughout your code
log("Product selected:", selectedProductData);
```

---

## 📊 Part 5: Local Testing Checklist

Before deploying to GitHub/Azure:

### Code Quality
- [ ] No console errors (F12)
- [ ] No console warnings
- [ ] All functions defined
- [ ] No undefined variables

### Functionality
- [ ] CWA folder selection works
- [ ] Model selection works
- [ ] Product name displays
- [ ] API methods return correct data
- [ ] Product data persists

### UI/UX
- [ ] Buttons are clickable
- [ ] Text is readable
- [ ] Layout looks good
- [ ] No broken images
- [ ] Responsive design works

### Performance
- [ ] No lag on selection
- [ ] API calls complete in <2 seconds
- [ ] No memory leaks
- [ ] Smooth interactions

### Error Handling
- [ ] Missing products handled gracefully
- [ ] Network errors handled
- [ ] Edge cases covered
- [ ] User feedback messages shown

### Testing
- [ ] TEST_PRODUCT_API.html passes all tests
- [ ] Manual console tests work
- [ ] Works with different products
- [ ] Works with different project structures

---

## 🚨 Part 6: Common Issues & Solutions

### Issue 1: "Cannot GET /index.html"

**Cause:** Server not running or wrong port

**Solution:**
```bash
# Make sure you're in the right directory
cd d:\api\ Develop\MyTrimbleExtension

# Start server
npx http-server -p 8080 -c-1

# Try http://localhost:8080
```

---

### Issue 2: "CORS Error" or "Access Denied"

**Cause:** Trimble Connect blocked your local origin

**Solution:** Use ngrok to get a proper HTTPS URL:
```bash
ngrok http 8080
# Use the ngrok.io URL instead of localhost
```

---

### Issue 3: "window.TrimbleConnectWorkspace is undefined"

**Cause:** Either:
1. Not running in Trimble Connect context
2. Script not loaded yet
3. Testing directly with HTML

**Solution:**
```javascript
// Check if available
if (window.TrimbleConnectWorkspace) {
    // You're in Trimble Connect
} else {
    // You're testing locally - use TEST_PRODUCT_API.html
}
```

---

### Issue 4: Changes Not Reflecting

**Cause:** Browser caching

**Solution:**
```bash
# Start server with cache disabled
npx http-server -p 8080 -c-1

# OR manually clear cache
# Press: Ctrl+Shift+Delete in browser
# OR: F12 → Settings → Disable cache while DevTools open
```

---

### Issue 5: "Cannot connect to Trimble API"

**Cause:** Wrong URL or no token

**Solution:**
- Check console logs for exact error
- Verify manifest URL is correct
- Verify access token is being sent
- Check Trimble Connect API is responding

---

## 🎯 Part 7: Recommended Development Workflow

### Daily Workflow:

```bash
# 1. Start your project
cd d:\api\ Develop\MyTrimbleExtension

# 2. Start local server with live reload
npx http-server -p 8080 -c-1

# 3. Open in browser
# http://localhost:8080

# 4. Open VS Code
code .

# 5. Edit files in VS Code
# Changes automatically reflected in browser

# 6. Open DevTools (F12)
# Check console for errors/logs

# 7. Test in Trimble Connect
# Use ngrok URL if testing full integration
```

---

### Before Each Release:

```bash
# 1. Run full test suite
# Open: http://localhost:8080/TEST_PRODUCT_API.html
# Click: "Run All Tests"

# 2. Test in Trimble Connect
# - Select model
# - Check console: window.TrimbleProductAPI.getSelectedProduct()

# 3. Check for errors
# DevTools → Console → No errors?

# 4. Test on different machine (if possible)
# Use ngrok URL

# 5. Commit to git
git add .
git commit -m "feat: [description]"
git push origin main
```

---

## 📦 Part 8: Quick Start Scripts

### Create `start-dev.bat` (Windows)

```batch
@echo off
cd d:\api\ Develop\MyTrimbleExtension
echo Starting local development server...
echo.
echo Open your browser to: http://localhost:8080
echo Test suite: http://localhost:8080/TEST_PRODUCT_API.html
echo.
echo Press Ctrl+C to stop
echo.
npx http-server -p 8080 -c-1
pause
```

Save this as `start-dev.bat` in your project folder. Double-click to start!

---

### Create `start-with-tunnel.bat` (Windows + ngrok)

```batch
@echo off
cd d:\api\ Develop\MyTrimbleExtension
echo Starting local server with ngrok tunnel...
echo.
start npx http-server -p 8080 -c-1
timeout /t 2
start ngrok http 8080
echo.
echo Check ngrok window for public URL
echo Use that URL in your Trimble extension manifest
echo.
pause
```

---

## 🔐 Part 9: Security Considerations for Local Testing

### When Testing Locally:

✅ **Safe to do:**
- Test with sample/test data
- Test with dummy credentials
- Test in development Trimble environment
- Use localhost (127.0.0.1)

⚠️ **Be careful with:**
- Real access tokens (don't commit them)
- Production data
- Office network access
- ngrok URLs (temporary, regenerated)

### Best Practices:

```javascript
// ❌ DON'T do this
const TOKEN = "abc123xyz";  // Never hardcode tokens!

// ✅ DO this instead
const TOKEN = process.env.TRIMBLE_TOKEN;  // Use environment variables

// OR use the official method
const token = await api.extension.requestPermission("accesstoken");
```

---

## 📈 Part 10: Performance Testing Locally

### Check Performance:

```javascript
// In console
performance.mark('start');
// Your function here
performance.mark('end');
performance.measure('my-function', 'start', 'end');
console.log(performance.getEntriesByName('my-function')[0]);
```

### Monitor Network:

1. F12 → Network tab
2. Reload page
3. Check:
   - How many requests?
   - Total load time?
   - Any 404 errors?
   - Response sizes?

---

## ✅ Summary

### To Develop Locally:

1. **Start server:**
   ```bash
   npx http-server -p 8080 -c-1
   ```

2. **Open in browser:**
   ```
   http://localhost:8080
   ```

3. **Test directly:**
   ```
   http://localhost:8080/TEST_PRODUCT_API.html
   ```

4. **Debug in console (F12):**
   ```javascript
   window.TrimbleProductAPI.getSelectedProduct()
   ```

5. **For full Trimble testing:**
   ```bash
   ngrok http 8080
   # Use ngrok URL in manifest
   ```

6. **Deploy when ready:**
   ```bash
   git push origin main
   ```

---

## 📚 Useful Resources

- **Node.js**: https://nodejs.org/
- **ngrok**: https://ngrok.com/
- **Live Server VS Code**: https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer
- **Browser DevTools**: F12 in any browser
- **Trimble Docs**: https://developer.trimble.com/docs/extensions

---

## 🎉 You're Ready!

You can now:
- ✅ Develop locally without GitHub/Azure/IIS
- ✅ Test with the included test suite
- ✅ Debug in real-time
- ✅ Test with Trimble Connect using ngrok
- ✅ Push to GitHub when ready

Happy coding! 🚀

# Local Development Troubleshooting Guide

## Quick Start (Copy-Paste)

### Windows Command Prompt
```bash
cd d:\api\ Develop\MyTrimbleExtension
npx http-server -p 8080 -c-1
```

### Windows PowerShell
```powershell
cd 'd:\api Develop\MyTrimbleExtension'
npx http-server -p 8080 -c-1
```

Then open: `http://localhost:8080`

---

## Issue 1: "Command not found: npx"

**Error Message:**
```
'npx' is not recognized as an internal or external command
```

**Causes:**
- Node.js not installed
- Node.js not in PATH

**Solutions:**

1. **Install Node.js:**
   - Download from https://nodejs.org/
   - Run installer (check "Add to PATH")
   - Restart terminal

2. **Verify installation:**
   ```bash
   node --version
   npm --version
   ```

3. **If still not working:**
   - Full path to npx:
   ```bash
   C:\Program Files\nodejs\npx.cmd http-server -p 8080 -c-1
   ```

---

## Issue 2: "Port 8080 already in use"

**Error Message:**
```
Error: listen EADDRINUSE: address already in use :::8080
```

**Causes:**
- Another process using port 8080
- Server from previous attempt still running

**Solutions:**

**Option 1: Use a different port**
```bash
npx http-server -p 3000 -c-1
# Then access: http://localhost:3000
```

**Option 2: Kill the process using port 8080**

Windows:
```bash
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

PowerShell:
```powershell
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force
```

**Option 3: Check what's using the port**
```bash
netstat -ano | findstr :8080
```

---

## Issue 3: "Cannot GET /index.html"

**Error in Browser:**
```
Cannot GET /index.html
```

**Causes:**
- Not in the right directory
- Files don't exist
- Server not running

**Solutions:**

1. **Check you're in right directory:**
   ```bash
   cd d:\api\ Develop\MyTrimbleExtension
   dir  # Should see: app.js, index.html, style.css, etc.
   ```

2. **Start server again:**
   ```bash
   npx http-server -p 8080 -c-1
   ```

3. **Check full file path:**
   ```
   http://localhost:8080/index.html
   ```

4. **If using subdirectory:**
   ```bash
   npx http-server . -p 8080 -c-1
   ```

---

## Issue 4: "Access to XMLHttpRequest blocked by CORS policy"

**Error in Console:**
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Causes:**
- Testing file:// protocol (not HTTP)
- Cross-origin request to Trimble API

**Solutions:**

1. **Always use HTTP server (not file://):**
   ```bash
   # ✅ Correct
   http://localhost:8080/index.html
   
   # ❌ Wrong
   file:///D:/api\ Develop/MyTrimbleExtension/index.html
   ```

2. **For Trimble Connect testing:**
   - Use ngrok for secure tunnel
   - Trimble requires HTTPS for extensions

3. **Check browser console:**
   - F12 → Console
   - Look for exact CORS error
   - Check if it's from Trimble API

---

## Issue 5: "Changes not showing in browser"

**Problem:**
- You edit a file, but browser shows old version

**Causes:**
- Browser cache
- File not saved
- Server not reloaded

**Solutions:**

1. **Hard refresh browser:**
   ```
   Ctrl+Shift+Delete  (Windows)
   Cmd+Shift+Delete   (Mac)
   ```

2. **Or force reload:**
   ```
   Ctrl+F5    (Windows)
   Cmd+Shift+R (Mac)
   ```

3. **Start server with no-cache:**
   ```bash
   npx http-server -p 8080 -c-1
   ```
   (The `-c-1` flag disables caching)

4. **Use Live Server extension:**
   - Install "Live Server" in VS Code
   - Right-click index.html
   - Select "Open with Live Server"
   - Auto-reloads on save

---

## Issue 6: "window.TrimbleConnectWorkspace is undefined"

**Problem:**
- Getting error that TrimbleConnectWorkspace is not available

**Causes:**
- Testing outside Trimble Connect environment
- Script not loaded yet
- Testing with direct HTML file

**Solutions:**

1. **For local testing (without Trimble):**
   ```javascript
   // Check if available
   if (window.TrimbleConnectWorkspace) {
       // You're in Trimble Connect
       console.log("Running in Trimble Connect");
   } else {
       // Local testing
       console.log("Local testing mode");
   }
   ```

2. **For Trimble Connect testing:**
   - Deploy with ngrok
   - Register manifest with Trimble
   - Open in actual Trimble Connect

3. **Use mock for testing:**
   - Create mock object:
   ```javascript
   if (!window.TrimbleConnectWorkspace) {
       window.TrimbleConnectWorkspace = {
           connect: async () => ({
               project: { getProject: () => ({ id: "test" }) },
               extension: { requestPermission: () => "test-token" },
               ui: { setMenu: () => {} }
           })
       };
   }
   ```

---

## Issue 7: "console errors in DevTools"

**Problem:**
- Console showing red errors

**Solution:**

1. **Check DevTools Console (F12):**
   - Click Console tab
   - Look for red error messages
   - Read the error carefully

2. **Common errors:**
   ```
   // Missing file
   GET http://localhost:8080/missing.js 404
   // Solution: Check file path
   
   // Undefined variable
   Uncaught ReferenceError: getSelectedProductData is not defined
   // Solution: Check app.js is loaded
   
   // Syntax error
   Uncaught SyntaxError: Unexpected token
   // Solution: Check for typos in code
   ```

3. **Debug step-by-step:**
   - Set breakpoint: Click line number in Sources tab
   - Reload page
   - Step through code
   - Inspect variables

---

## Issue 8: "ngrok connection refused"

**Error:**
```
Error: connect ECONNREFUSED
```

**Causes:**
- Local server not running
- Port mismatch
- ngrok pointing to wrong port

**Solutions:**

1. **Verify local server is running:**
   ```bash
   http://localhost:8080  # Open in browser
   ```

2. **Check ngrok configuration:**
   ```bash
   ngrok http 8080  # Make sure this matches your server port
   ```

3. **Restart in order:**
   ```bash
   # 1. Start local server first
   npx http-server -p 8080 -c-1
   
   # 2. Wait a moment
   # 3. Then start ngrok
   ngrok http 8080
   ```

---

## Issue 9: "Cannot connect to Trimble API"

**Error:**
```
Trimble Connect data request failed (401)
```

**Causes:**
- Invalid/expired access token
- Missing permissions in manifest
- Wrong Trimble environment

**Solutions:**

1. **Check manifest permissions:**
   ```json
   "permissions": [
     "accesstoken",  // ← Make sure this is here
     "projects"
   ]
   ```

2. **Check token request:**
   ```javascript
   const token = await api.extension.requestPermission("accesstoken");
   console.log("Token received:", token);
   ```

3. **Check Trimble environment:**
   - Verify you're using correct Trimble region
   - Check if you have project access
   - Verify API endpoints are accessible

---

## Issue 10: "ngrok URL keeps changing"

**Problem:**
- ngrok URL is different every time you run it

**Solution:**
- This is normal! ngrok generates a new URL each time
- If you need a permanent URL:
  - Upgrade ngrok account (paid)
  - Use reserved domains
  - Or keep a batch file with ngrok running

---

## Quick Diagnostic Checklist

```bash
# 1. Check Node.js installed
node --version
npm --version

# 2. Check you're in right folder
cd d:\api\ Develop\MyTrimbleExtension
pwd  # or "cd" on Windows to see current path

# 3. Check files exist
dir

# 4. Check if port is free
netstat -ano | findstr :8080

# 5. Start server
npx http-server -p 8080 -c-1

# 6. Open browser
# http://localhost:8080

# 7. Check console (F12)
# Look for errors
```

---

## Testing Workflow

### Phase 1: Local Static Testing
```bash
1. Start server
2. Open http://localhost:8080
3. Check UI loads
4. Open F12 Console
5. No errors should appear
```

### Phase 2: Unit Testing
```bash
1. Open http://localhost:8080/TEST_PRODUCT_API.html
2. Click each test
3. Verify results (all should pass)
```

### Phase 3: Full Integration (Trimble Connect)
```bash
1. Start local server + ngrok
2. Get ngrok URL
3. Update manifest
4. Register in Trimble Admin
5. Open in Trimble Connect
6. Select a model
7. Check F12 console for logs
8. Verify API works
```

---

## Getting Help

If you're stuck:

1. **Check console (F12)**
   - Most errors shown here
   - Copy exact error message

2. **Check server logs**
   - Look at terminal running http-server
   - Check for any warnings

3. **Check manifest**
   - Verify URL is correct
   - Verify permissions listed
   - Verify JSON is valid

4. **Restart everything**
   ```bash
   Ctrl+C  # Stop server
   # Clear browser cache (Ctrl+Shift+Delete)
   # Start server again
   # Refresh browser
   ```

5. **Try different port**
   ```bash
   npx http-server -p 3000 -c-1
   ```

---

## Summary

**Most Common Solutions:**

| Problem | Solution |
|---------|----------|
| Port in use | Use different port: `-p 3000` |
| Files not found | Verify you're in right directory |
| Cache issues | Hard refresh: `Ctrl+Shift+Delete` |
| Changes not showing | Disable cache: `-c-1` flag |
| CORS errors | Use HTTP server, not file:// |
| Trimble errors | Use ngrok for HTTPS tunnel |
| Can't find ngrok | Install from ngrok.com |
| npm not found | Install Node.js from nodejs.org |

---

## Next Steps

1. ✅ Install Node.js (if needed)
2. ✅ Run `start-dev.bat` or `npx http-server -p 8080 -c-1`
3. ✅ Open http://localhost:8080
4. ✅ Test with TEST_PRODUCT_API.html
5. ✅ Debug with F12 Console
6. ✅ Use ngrok for Trimble Connect testing

You're all set! 🚀

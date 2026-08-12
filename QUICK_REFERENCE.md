# 🚀 Local Development - Quick Reference

## ⚡ Get Started in 2 Minutes

### Step 1: Open Terminal/PowerShell
```bash
cd d:\api\ Develop\MyTrimbleExtension
```

### Step 2: Start Your Local Server
**Option A: Easiest (No Installation)**
```bash
npx http-server -p 8080 -c-1
```

**Option B: Using Batch File**
- Double-click `start-dev.bat`

**Option C: Using PowerShell**
```powershell
.\start-dev.ps1
```

### Step 3: Open Browser
Visit: **http://localhost:8080**

✅ **That's it! Your app is running locally!**

---

## 🧪 Testing Locally

### Test Interactive Suite
```
http://localhost:8080/TEST_PRODUCT_API.html
```
- Click buttons to test features
- All tests pass? You're good to go!

### Test in Browser Console (F12)
```javascript
window.TrimbleProductAPI.getSelectedProduct()
```

### View Debug Logs
- Press F12
- Check Console tab
- Look for "Selected product data updated:" messages

---

## 🔗 Testing with Trimble Connect

### If Your Office Has Network Access:

**Step 1: Install ngrok**
- Download: https://ngrok.com
- Unzip anywhere
- Add to PATH (or just run from folder)

**Step 2: Start Both Servers**
```bash
# Terminal 1 - Your app
npx http-server -p 8080 -c-1

# Terminal 2 - ngrok tunnel
ngrok http 8080
```

**Step 3: Get ngrok URL**
- Look at ngrok terminal
- Find line like: `https://1234-5678-abcd.ngrok.io`
- Copy that URL

**Step 4: Update Your Manifest**
Edit `extension-manifest.json`:
```json
{
  "url": "https://1234-5678-abcd.ngrok.io/",
  ...
}
```

**Step 5: Test in Trimble Connect**
- Register manifest in Trimble Admin
- Open your project
- Your extension appears
- Select a model
- Check F12 console for logs

---

## 📁 Files You Now Have

| File | Purpose |
|------|---------|
| `start-dev.bat` | Quick start dev server (Windows) |
| `start-dev-with-tunnel.bat` | Dev server + ngrok (Windows) |
| `start-dev.ps1` | Dev server (PowerShell) |
| `LOCAL_DEVELOPMENT_GUIDE.md` | Complete setup guide |
| `TROUBLESHOOTING.md` | Problem solutions |
| `TEST_PRODUCT_API.html` | Interactive test suite |

---

## 🆘 Quick Troubleshooting

### Problem: "npx not found"
```bash
# Install Node.js from: https://nodejs.org/
# Then restart terminal and try again
```

### Problem: "Port 8080 already in use"
```bash
# Use different port
npx http-server -p 3000 -c-1
# Then visit: http://localhost:3000
```

### Problem: "Changes not showing"
```bash
# Press: Ctrl+Shift+Delete (clear cache)
# Or: Hard refresh Ctrl+F5
```

### Problem: "Can't see Trimble API"
```bash
# That's normal! Use TEST_PRODUCT_API.html instead
# Or test with ngrok + actual Trimble Connect
```

**More issues?** → See `TROUBLESHOOTING.md`

---

## 📚 Documentation You Have

1. **LOCAL_DEVELOPMENT_GUIDE.md**
   - Complete setup instructions
   - 10 sections covering every aspect
   - Recommended workflow
   - Security tips

2. **TROUBLESHOOTING.md**
   - 10 common issues with fixes
   - Diagnostic commands
   - Testing checklist

3. **QUICK_START.md**
   - Overview of product data API
   - Usage examples
   - Use cases

4. **PRODUCT_DATA_API.md**
   - Complete API reference
   - All methods documented
   - Troubleshooting guide

5. **IMPLEMENTATION_SUMMARY.md**
   - Technical details
   - Code changes explained
   - Version info

6. **PROJECT_COMPLETION_REPORT.md**
   - Full project report
   - Metrics and deliverables

---

## 💡 Pro Tips

### Tip 1: Live Reload
Use VS Code **Live Server** extension for auto-reload:
1. Install extension
2. Right-click `index.html`
3. Select "Open with Live Server"
4. Changes auto-reload!

### Tip 2: Better Debugging
Add this to `app.js`:
```javascript
const DEBUG = true;
function log(msg, data) {
    if (DEBUG) console.log(`[TrimbleExt] ${msg}`, data);
}
```

### Tip 3: Test Different Data
Modify `TEST_PRODUCT_API.html` to test your specific scenarios

### Tip 4: Keep Local Notes
Create `LOCAL_NOTES.md` for your office-specific setup

### Tip 5: Network Testing
If office network restricted:
- Test with localhost first (works offline)
- Then add ngrok for Trimble testing
- Use `TROUBLESHOOTING.md` section on CORS

---

## ✅ Development Checklist

Before deployment:

- [ ] Local server runs without errors
- [ ] TEST_PRODUCT_API.html passes all tests
- [ ] Console (F12) shows no errors
- [ ] Product data accessible via API
- [ ] UI looks good on your screen
- [ ] Tested with different screen sizes (F12 responsive mode)
- [ ] All documentation reviewed
- [ ] Ready to push to GitHub

---

## 📈 Common Workflow

### Daily Development:
```bash
1. start-dev.bat (or npx http-server -p 8080 -c-1)
2. Open http://localhost:8080
3. Edit files in VS Code
4. See changes instantly (if using Live Server)
5. Test in http://localhost:8080/TEST_PRODUCT_API.html
6. Debug with F12 Console
7. Commit when ready: git push origin main
```

### Testing with Trimble:
```bash
1. start-dev-with-tunnel.bat (or manual ngrok)
2. Get ngrok URL
3. Update manifest with ngrok URL
4. Register in Trimble Connect Admin
5. Open Trimble Connect
6. Test your extension
7. Check F12 Console
```

### Before Pushing to GitHub:
```bash
1. Run full test suite
2. Check for console errors
3. Test on different browsers (if possible)
4. Verify documentation is up-to-date
5. git add .
6. git commit -m "your message"
7. git push origin main
```

---

## 🎯 Next Steps Right Now

### Immediate (Next 5 minutes):
1. ✅ Open terminal
2. ✅ Run: `npx http-server -p 8080 -c-1`
3. ✅ Visit: `http://localhost:8080`
4. ✅ You're developing!

### Short Term (Next hour):
1. ✅ Read `LOCAL_DEVELOPMENT_GUIDE.md`
2. ✅ Test with `TEST_PRODUCT_API.html`
3. ✅ Try console commands
4. ✅ Make a small code change
5. ✅ Test the change

### Medium Term (Today):
1. ✅ Review all documentation
2. ✅ Set up ngrok if you need Trimble testing
3. ✅ Test full workflow locally
4. ✅ Plan your development schedule

---

## 🆘 When You Get Stuck

1. **Read TROUBLESHOOTING.md** - 90% of issues covered
2. **Check browser console (F12)** - Read the error message
3. **Check terminal output** - Server might be showing errors
4. **Try a different port** - `npx http-server -p 3000 -c-1`
5. **Clear cache** - `Ctrl+Shift+Delete` in browser
6. **Restart everything** - Kill server, clear cache, restart

---

## ✨ You're All Set!

You now have everything needed to:
- ✅ Develop locally without external deployment
- ✅ Test thoroughly before pushing to GitHub
- ✅ Debug issues with browser tools
- ✅ Test full integration with Trimble Connect (via ngrok)
- ✅ Iterate quickly with live server
- ✅ Deploy to GitHub when ready

**No external deployment needed until you're ready!**

---

## 📞 Support Resources

- `LOCAL_DEVELOPMENT_GUIDE.md` - Complete setup
- `TROUBLESHOOTING.md` - Problem solutions
- `TEST_PRODUCT_API.html` - Interactive testing
- Browser DevTools (F12) - Real-time debugging
- GitHub repository - Your code and all docs

---

## 🚀 Happy Coding!

You're ready to develop and test locally! 

Start with:
```bash
npx http-server -p 8080 -c-1
```

Then visit: `http://localhost:8080`

Enjoy! 🎉

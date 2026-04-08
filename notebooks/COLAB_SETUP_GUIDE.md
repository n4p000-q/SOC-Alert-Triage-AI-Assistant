# 🚀 Google Colab Setup Guide

## Complete Step-by-Step Instructions for Running XGBoost on Colab

---

## 📋 **Prerequisites**

Before starting, make sure you have:
- ✅ Run `02_preprocessing.ipynb` locally to generate processed CSVs
- ✅ Google account (free)
- ✅ Files ready to upload:
  - `X_train.csv`
  - `X_test.csv`
  - `y_train.csv`
  - `y_test.csv`

---

## 🗂️ **Step 1: Organize Files in Google Drive**

### **1.1 Open Google Drive**
1. Go to: https://drive.google.com
2. Sign in with your Google account

### **1.2 Create Folder Structure**

Create this exact structure in "My Drive":

```
My Drive/
└── SOC_Project/
    ├── data/
    │   └── processed/
    │       ├── X_train.csv
    │       ├── X_test.csv
    │       ├── y_train.csv
    │       └── y_test.csv
    └── models/  (will be created automatically by notebook)
```

**How to create folders:**
1. Click "New" → "New folder"
2. Name it `SOC_Project`
3. Open `SOC_Project`, click "New" → "New folder", name it `data`
4. Open `data`, create folder `processed`

### **1.3 Upload CSV Files**

1. Navigate to `My Drive/SOC_Project/data/processed/`
2. Click "New" → "File upload"
3. Select all 4 CSV files:
   - `X_train.csv`
   - `X_test.csv`
   - `y_train.csv`
   - `y_test.csv`
4. Wait for upload to complete

**✅ Verify:** You should see 4 CSV files in the `processed` folder

---

## 💻 **Step 2: Open Google Colab**

### **2.1 Go to Colab**
1. Go to: https://colab.research.google.com
2. Sign in with the same Google account

### **2.2 Upload Notebook**

**Option A: Upload File**
1. Click "File" → "Upload notebook"
2. Select `03_xgboost_optimized_COLAB.ipynb`
3. Click "Upload"

**Option B: Open from Drive**
1. Upload notebook to Google Drive first
2. In Colab, click "File" → "Open notebook"
3. Click "Google Drive" tab
4. Navigate to and select your notebook

---

## ⚡ **Step 3: Enable GPU (Optional but Recommended)**

### **3.1 Change Runtime Type**
1. Click "Runtime" → "Change runtime type"
2. Under "Hardware accelerator" select **T4 GPU**
3. Click "Save"

**Why?** 
- GPU makes training 2-3x faster
- Free on Colab
- Recommended for ML workloads

---

## 🎮 **Step 4: Run the Notebook**

### **4.1 Mount Google Drive (First Cell)**

1. Run the first cell (Shift+Enter)
2. You'll see: "Go to this URL in a browser"
3. Click the link
4. Select your Google account
5. Click "Allow"
6. Copy the authorization code
7. Paste it back in Colab
8. Press Enter

**✅ Success message:** "Google Drive mounted successfully!"

### **4.2 Run All Cells**

**Option A: Run All**
1. Click "Runtime" → "Run all"
2. Sit back and let it run (20-25 minutes total)

**Option B: Run Cell by Cell**
1. Click on first cell
2. Press Shift+Enter to run
3. Move to next cell
4. Repeat

**⏱️ Estimated Time:**
- Data loading: 1-2 minutes
- Baseline model: 2-3 minutes
- Hyperparameter optimization: 15-20 minutes
- Everything else: 5 minutes
- **Total: ~25 minutes**

---

## 📊 **Step 5: Monitor Progress**

### **5.1 What to Watch For**

**✅ Good signs:**
```
✅ Google Drive mounted successfully!
✅ All required files found!
✅ All data loaded successfully!
✅ Training complete!
✅ HYPERPARAMETER OPTIMIZATION COMPLETE!
```

**❌ Error signs:**
```
❌ ERROR: Folder not found!
❌ ERROR: Missing files!
FileNotFoundError: ...
```

### **5.2 During Hyperparameter Optimization**

You'll see output like:
```
Fitting 3 folds for each of 50 candidates, totalling 150 fits
[Parallel(n_jobs=-1)]: Done  33 tasks      | elapsed:  2.1min
[Parallel(n_jobs=-1)]: Done  99 tasks      | elapsed:  6.3min
...
```

**💡 Tip:** You can minimize the Colab tab and come back in 20 minutes!

---

## 💾 **Step 6: Access Results**

### **6.1 Automatic Save to Drive**

All results are automatically saved to:
```
My Drive/SOC_Project/models/
```

Files created:
- `xgboost_optimized.json` (trained model)
- `xgboost_results.json` (all metrics)
- `xgboost_predictions.csv` (test predictions)
- `feature_importance.csv` (feature rankings)
- 6 PNG files (visualizations)

### **6.2 Download Files**

**Option A: From Google Drive**
1. Go to drive.google.com
2. Navigate to `SOC_Project/models/`
3. Right-click file → Download
4. Or select multiple → right-click → Download

**Option B: Direct from Colab**
Run this cell in Colab:
```python
from google.colab import files

# Download single file
files.download('/content/drive/MyDrive/SOC_Project/models/xgboost_results.json')

# Or zip everything
import shutil
shutil.make_archive('/content/results', 'zip', 
                   '/content/drive/MyDrive/SOC_Project/models')
files.download('/content/results.zip')
```

---

## 🔧 **Troubleshooting**

### **Problem: "Folder not found"**
**Solution:**
1. Check folder name spelling: `SOC_Project` (exact)
2. Verify path: `My Drive/SOC_Project/data/processed/`
3. Make sure Drive is mounted (first cell ran successfully)

### **Problem: "Missing files"**
**Solution:**
1. Verify all 4 CSVs are uploaded to correct folder
2. Check file names match exactly:
   - `X_train.csv` (not `x_train.csv`)
   - `X_test.csv`
   - `y_train.csv`
   - `y_test.csv`
3. Re-upload if necessary

### **Problem: "Runtime disconnected"**
**Solution:**
1. Colab free tier disconnects after 12 hours or if idle too long
2. Just reconnect: "Runtime" → "Connect"
3. Re-run cells from where it stopped
4. Your Drive files are safe!

### **Problem: "Out of memory"**
**Solution:**
1. Make sure you selected GPU runtime (Step 3)
2. Try restarting runtime: "Runtime" → "Restart runtime"
3. Run notebook again

### **Problem: Slow training**
**Check:**
1. Is GPU enabled? (Runtime → Change runtime type)
2. Is this a free Colab account? (limited resources)
3. Try running during off-peak hours

---

## 📝 **Tips & Best Practices**

### **✅ Do:**
- ✅ Enable GPU for faster training
- ✅ Save notebook to Drive regularly (File → Save a copy in Drive)
- ✅ Download results immediately after completion
- ✅ Keep Colab tab open during training
- ✅ Check outputs folder in Drive to verify saves

### **❌ Don't:**
- ❌ Close browser during training (it will disconnect)
- ❌ Change runtime type mid-training (will restart)
- ❌ Edit files in Drive while notebook is running
- ❌ Run multiple notebooks simultaneously (memory issues)

---

## 🎯 **Expected Final Output**

### **In Colab:**
```
==========================================================================
EXPERIMENT COMPLETE!
==========================================================================

✅ COMPLETED STEPS:
   1. ✓ Mounted Google Drive
   2. ✓ Loaded preprocessed data
   ...
   11. ✓ Saved all results to Google Drive

==========================================================================
FINAL RESULTS
==========================================================================
   Accuracy:  XX.XX%
   Precision: XX.XX%
   Recall:    XX.XX%
   F1-Score:  XX.XX%
   ROC-AUC:   X.XXXX

==========================================================================
✨ XGBoost BASELINE ESTABLISHED! ✨
==========================================================================
```

### **In Google Drive:**
```
SOC_Project/models/
├── xgboost_optimized.json         (~1 MB)
├── xgboost_results.json            (~5 KB)
├── xgboost_predictions.csv         (~3 MB)
├── feature_importance.csv          (~10 KB)
├── cross_validation.png
├── feature_importance.png
├── learning_curves.png
├── threshold_optimization.png
├── test_evaluation.png
└── (maybe more visualizations)
```

---

## 🚀 **Quick Start Checklist**

Before running, verify:

- [ ] Created `SOC_Project/data/processed/` in Google Drive
- [ ] Uploaded all 4 CSV files to that folder
- [ ] Opened Colab (colab.research.google.com)
- [ ] Uploaded notebook to Colab
- [ ] Enabled GPU runtime (Runtime → Change runtime type → T4 GPU)
- [ ] Ready to run!

**Run this cell first to verify everything:**
```python
from google.colab import drive
drive.mount('/content/drive')

import os
path = '/content/drive/MyDrive/SOC_Project/data/processed/'
files = os.listdir(path) if os.path.exists(path) else []
print(f"Found {len(files)} files: {files}")
```

**Expected output:**
```
Found 4 files: ['X_train.csv', 'X_test.csv', 'y_train.csv', 'y_test.csv']
```

---

## 📧 **Need Help?**

If you encounter issues:
1. Check error message carefully
2. Verify folder structure in Drive
3. Try restarting runtime
4. Re-upload files if necessary

---

**Good luck! You're ready to train your XGBoost baseline! 🎉**

#!/bin/bash
# ============================================================
# SOC Analyst Triage AI Assistant — Ubuntu Environment Setup
# Run this script once from your project root directory
# Usage: bash setup_soc_env.sh
# ============================================================

set -e  # Exit immediately on any error

echo "=== Step 1: Install system dependencies ==="
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip git

echo ""
echo "=== Step 2: Create virtual environment (Python 3.11) ==="
python3.11 -m venv soc_env

echo ""
echo "=== Step 3: Activate virtual environment ==="
source soc_env/bin/activate

echo ""
echo "=== Step 4: Upgrade pip inside the environment ==="
pip install --upgrade pip

echo ""
echo "=== Step 5: Install all project dependencies ==="
pip install \
    scikit-learn==1.7.2 \
    xgboost==3.1.1 \
    pandas \
    numpy \
    tensorflow \
    keras \
    matplotlib \
    plotly \
    shap \
    flask \
    jupyter \
    ipykernel

echo ""
echo "=== Step 6: Register Jupyter kernel named 'soc_env' ==="
python -m ipykernel install --user --name=soc_env --display-name "soc_env"

echo ""
echo "=== Step 7: Verify key package versions ==="
python -c "
import sklearn, xgboost, pandas, numpy, tensorflow
print('scikit-learn :', sklearn.__version__)
print('xgboost      :', xgboost.__version__)
print('pandas       :', pandas.__version__)
print('numpy        :', numpy.__version__)
print('tensorflow   :', tensorflow.__version__)
print()
print('All packages installed successfully!')
"

echo ""
echo "================================================================"
echo "  Setup complete!"
echo ""
echo "  To activate your environment in any new terminal:"
echo "    source soc_env/bin/activate"
echo ""
echo "  To launch Jupyter Notebook:"
echo "    jupyter notebook"
echo ""
echo "  In your notebooks, select kernel: 'soc_env'"
echo "================================================================"

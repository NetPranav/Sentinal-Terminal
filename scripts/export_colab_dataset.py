#!/usr/bin/env python3
"""
export_colab_dataset.py — Python CLI Wrapper for Sentinel Dataset Compilation

Runs the dataset exporter and outputs the paths to:
- sentinel_sft_dataset.jsonl
- sentinel_dpo_dataset.jsonl
- sentinel_training_package.zip
"""

import sys
import subprocess
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent.parent
    script_ts = root / "scripts" / "export_colab_dataset.ts"

    if not script_ts.exists():
        print(f"Error: Could not find {script_ts}")
        sys.exit(1)

    print("Running Sentinel Dataset Exporter via tsx...")
    cmd = ["npx", "tsx", str(script_ts)]
    res = subprocess.run(cmd, cwd=str(root))
    sys.exit(res.returncode)

if __name__ == "__main__":
    main()

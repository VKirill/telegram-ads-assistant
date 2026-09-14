#!/usr/bin/env python3
"""Install catalog dependencies into an isolated user environment."""
import os,subprocess,venv
from pathlib import Path
root=Path.home()/'.local/share/telegram-ads/venv'
venv.EnvBuilder(with_pip=True).create(root)
python=root/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
subprocess.run([str(python),'-m','pip','install','-r',str(Path(__file__).resolve().parents[1]/'requirements.txt')],check=True)
print('Catalog environment ready: '+str(python))

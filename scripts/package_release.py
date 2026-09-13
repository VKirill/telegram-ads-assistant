#!/usr/bin/env python3
"""Package only public source files; never include local runtime state."""
import hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'manifest.json').read_text())['version']
out=root/'dist';out.mkdir(exist_ok=True)
files=[]
for name in ['VALIDATION.md','README.md','manifest.json','index.html','style.css','package.json','package-lock.json','mcp-config.example.json','Start.command','.gitignore']:
 files.append(root/name)
for name in ['src','server','tests','fixtures','skills','scripts','.github']:
 files += [p for p in (root/name).rglob('*') if p.is_file() and p.name!='local-config.js' and '__pycache__' not in p.parts]
archive=out/f'telegram-ads-assistant-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(files):
  relative=p.relative_to(root)
  if '.local' in relative.parts or 'node_modules' in relative.parts:raise RuntimeError('Private path')
  z.write(p,str(Path(f'telegram-ads-assistant-{version}')/relative))
(out/'SHA256SUMS').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(archive)

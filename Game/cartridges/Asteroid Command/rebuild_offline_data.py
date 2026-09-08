"""Rebuild files/datasets/offline-data.js from the CSVs beside it.

Why this exists
---------------
Double-clicking "Asteroid Command.html" opens the game over file://, and browsers
refuse to let a file:// page fetch() its own CSVs. A <script> tag, however, loads
fine. So this bakes the CSV text into a plain .js file that the page can load as a
script, and core/data.js parses it through the exact same code path as the live
fetch. Same data, same parser, no web server.

Run it after editing any dataset — or just double-click "Rebuild Offline Data.bat".
"""
import datetime
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, 'files', 'datasets')
OUT = os.path.join(DATA_DIR, 'offline-data.js')

# The six the game actually loads. Anything else in datasets/ is a working file.
FILES = [
    'bases.csv',
    'commands.csv',
    'units.csv',
    'progression.csv',
    'scoring.csv',
    'shorthand.csv',
]

payload = {}
missing = []
for name in FILES:
    path = os.path.join(DATA_DIR, name)
    if not os.path.exists(path):
        missing.append(name)
        continue
    with open(path, encoding='utf-8-sig') as f:
        payload[name] = f.read()

if missing:
    print('WARNING: not found in datasets/ -> ' + ', '.join(missing))

built = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
blob = json.dumps({'built': built, 'files': payload}, indent=2, ensure_ascii=False)

banner = (
    '/* AUTO-GENERATED - DO NOT EDIT BY HAND.\n'
    '   Rebuilt by "Rebuild Offline Data.bat" (rebuild_offline_data.py).\n'
    '   Edit the CSVs in this folder, then run that; editing this file directly\n'
    '   will just be overwritten.\n\n'
    '   This is a <script>-tag copy of the CSVs so the game still has real data\n'
    '   when it is opened straight off the disk, where fetch() is blocked.\n'
    '   Built: %s */\n' % built
)

with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(banner)
    f.write('window.OFFLINE_DATASETS = ')
    f.write(blob)
    f.write(';\n')

print('Wrote %s' % os.path.relpath(OUT, HERE))
print('Built: %s' % built)
for name in FILES:
    if name in payload:
        rows = max(0, len([l for l in payload[name].splitlines() if l.strip()]) - 1)
        print('  %-18s %5d rows' % (name, rows))

sys.exit(1 if missing else 0)

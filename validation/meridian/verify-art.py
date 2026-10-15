"""Validate baked alpha atlases and measured sockets for the complete roster."""
from pathlib import Path
from PIL import Image
import json
import math

ROOT=Path(__file__).resolve().parents[2]
roster=json.loads((ROOT/'tools/meridian-roster.json').read_text())['characters']
report={'atlases':0,'frames':0,'empty':[],'clipped':[],'socketIssues':[],'sizeIssues':[]}
for fighter in roster:
    slug=fighter['id']
    variants=['base','empowered'] if slug=='moro' else [None]
    for variant in variants:
        folder=ROOT/'assets/meridian/fighters'/slug
        if variant:folder/=variant
        values={}
        for line in (folder/'manifest.js').read_text().splitlines():
            if line.startswith('window.'):
                name,raw=line.split(' = ',1)
                values[name[7:]]=json.loads(raw.removesuffix(';'))
        manifest=next(value for key,value in values.items() if key.endswith('MANIFEST'))
        metrics=next(value for key,value in values.items() if key.endswith('METRICS'))
        layout=manifest['frame_layout']
        with Image.open(folder/'run/sprite-sheet-alpha.webp') as atlas:
            if atlas.size!=(layout['sheetWidth'],layout['sheetHeight']):
                report['sizeIssues'].append(slug+'/'+str(variant))
            alpha=atlas.getchannel('A')
            for state,rects in layout['rows'].items():
                for index,rect in enumerate(rects):
                    report['frames']+=1
                    crop=alpha.crop((rect['x'],rect['y'],rect['x']+rect['w'],rect['y']+rect['h']))
                    box=crop.point(lambda a:255 if a>15 else 0).getbbox()
                    label=f'{slug}/{variant or "base"}/{state}/{index}'
                    if box is None:report['empty'].append(label)
                    elif min(box[0],box[1],rect['w']-box[2],rect['h']-box[3])<2:
                        report['clipped'].append({'frame':label,'alphaBounds':box})
            report['atlases']+=1
        for state,socket in metrics.get('emitters',{}).items():
            if any(not math.isfinite(socket[axis]) for axis in ('x','y')):
                report['socketIssues'].append(f'{slug}/{state}:nonfinite')
            elif abs(socket['x'])>manifest['cell']['width']/2 or abs(socket['y'])>manifest['cell']['height']:
                report['socketIssues'].append(f'{slug}/{state}:out-of-cell')
( ROOT/'validation/meridian/art-check.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({key:len(val) if isinstance(val,list) else val for key,val in report.items()},indent=2))
assert not any(report[key] for key in ('empty','clipped','socketIssues','sizeIssues'))

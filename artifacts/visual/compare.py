from pathlib import Path
import cv2
import numpy as np
import json

root = Path(__file__).parent
results = {}
for suffix in ['-before', '']:
    a = cv2.imread(str(root / f'editor{suffix}.png'))
    b = cv2.imread(str(root / f'preview{suffix}.png'))
    h, w = max(a.shape[0], b.shape[0]), max(a.shape[1], b.shape[1])
    def pad(im):
        canvas = np.full((h, w, 3), 255, np.uint8)
        canvas[:im.shape[0], :im.shape[1]] = im
        return canvas
    a, b = pad(a), pad(b)
    delta = cv2.absdiff(a, b)
    mask = np.max(delta, axis=2) > 25
    overlay = cv2.addWeighted(a, .5, b, .5, 0)
    heat = np.full_like(a, 255)
    heat[mask] = (50, 40, 230)
    cv2.imwrite(str(root / f'overlay{suffix}.png'), overlay)
    cv2.imwrite(str(root / f'difference{suffix}.png'), heat)
    cv2.imwrite(str(root / f'side-by-side{suffix}.png'), np.concatenate([a,b,heat], axis=1))
    results['before' if suffix else 'after'] = {'editor_size':list(cv2.imread(str(root / f'editor{suffix}.png')).shape[:2]), 'preview_size':list(cv2.imread(str(root / f'preview{suffix}.png')).shape[:2]), 'different_pixels_percent':round(float(mask.mean()*100),3), 'mean_absolute_channel_error':round(float(delta.mean()),3), 'threshold':25}
(root / 'metrics.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))

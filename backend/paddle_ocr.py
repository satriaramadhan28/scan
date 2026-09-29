import sys
import json
import base64
import os
import io

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_ocr(image_bytes_or_path):
    try:
        from rapidocr_onnxruntime import RapidOCR
        from PIL import Image
        import numpy as np

        ocr = RapidOCR()
        if isinstance(image_bytes_or_path, (bytes, bytearray)):
            img = Image.open(io.BytesIO(image_bytes_or_path)).convert('RGB')
            img_np = np.array(img)
            result, elapse = ocr(img_np)
        else:
            result, elapse = ocr(image_bytes_or_path)

        if not result:
            return {"success": True, "text": "", "lines": [], "boxes": [], "confidence": 0}

        lines = [item[1] for item in result]
        boxes = []
        scores = []
        for item in result:
            box = item[0] if len(item) > 0 else []
            text = item[1] if len(item) > 1 else ""
            score = float(item[2]) if len(item) > 2 else 0.9
            scores.append(score)
            boxes.append({"box": box, "text": text, "score": score})

        avg_conf = round(sum(scores) / len(scores) * 100) if scores else 90
        full_text = "\n".join(lines)
        return {
            "success": True,
            "text": full_text,
            "lines": lines,
            "boxes": boxes,
            "confidence": avg_conf
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if os.path.isfile(arg):
            res = run_ocr(arg)
            print(json.dumps(res, ensure_ascii=False))
            sys.exit(0)
    
    # Read base64 or stdin
    input_data = sys.stdin.read().strip()
    if input_data.startswith("data:"):
        input_data = input_data.split(",", 1)[1]
    
    try:
        img_bytes = base64.b64decode(input_data)
        res = run_ocr(img_bytes)
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

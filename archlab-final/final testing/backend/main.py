import cv2
import numpy as np
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PRINOVA Vision Processing Engine")

# Crucial: Allows your frontend to talk to this Python server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prototype Constants
PIXELS_PER_METER = 50.0  
DEFAULT_WALL_HEIGHT = 2.8 # Applied if height is missing

@app.post("/api/scan-blueprint")
async def scan_blueprint(file: UploadFile = File(...)):
    """
    Takes a 2-D plane image, scans for architectural references using OpenCV, 
    and returns dimensions for 3-D generation.
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # 1. Computer Vision: Scan image for architectural references
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 200, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    extracted_walls = []
    
    # 2. Process dimensions and estimate where needed
    for i, contour in enumerate(contours):
        if cv2.contourArea(contour) > 100: 
            x, y, w, h = cv2.boundingRect(contour)
            
            # Convert pixels to meters
            length_m = round(max(w, h) / PIXELS_PER_METER, 2)
            width_m = round(min(w, h) / PIXELS_PER_METER, 2)
            
            # Filter out non-wall objects
            if width_m > 1.0: continue

            # Determine room grouping for 3D visual coloring
            room_type = "LIVING"
            if length_m > 6.0:
                room_type = "OUTER"
            elif i % 3 == 0:
                room_type = "KITCHEN"

            extracted_walls.append({
                "id": f"wall_{i}",
                "type": room_type,
                "length": length_m,
                "width": max(0.15, width_m), 
                "height": DEFAULT_WALL_HEIGHT, 
                "position": [round(x/PIXELS_PER_METER, 2), 0, round(y/PIXELS_PER_METER, 2)]
            })

    # 3. Generate Scanned 2D Model visual overlay for the frontend
    cv2.drawContours(img, contours, -1, (0, 255, 0), 2)
    _, encoded_img = cv2.imencode('.jpg', img)
    preview_base64 = base64.b64encode(encoded_img).decode('utf-8')

    return {
        "status": "success",
        "wall_count": len(extracted_walls),
        "walls": extracted_walls,
        "preview_image": f"data:image/jpeg;base64,{preview_base64}"
    }

if __name__ == "__main__":
    import uvicorn
    # Runs the server on http://localhost:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
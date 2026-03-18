import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from app.auth.keycloak import get_current_user, require_admin

router = APIRouter(
    prefix="/api/traps/mibs",
    tags=["traps,mibs"],
)

@router.get("/")
def list_mibs(user: dict = Depends(get_current_user)):
    try:
        files = [f for f in os.listdir(MIBS_DIR) if os.path.isfile(os.path.join(MIBS_DIR, f))]
        return JSONResponse(content={"mibs": files})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.delete("/{filename}")
def delete_mib(filename: str, user: dict = Depends(get_current_user)):
    file_path = os.path.join(MIBS_DIR, filename)
    try:
        if os.path.exists(file_path) and os.path.isfile(file_path):
            os.remove(file_path)
            return JSONResponse(content={"message": f"{filename} deleted."})
        return JSONResponse(status_code=404, content={"error": "File not found."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.post("/")
async def upload_mib(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    try:
        file_path = os.path.join(MIBS_DIR, file.filename)

        # Save uploaded file to the MIBS_DIR
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return JSONResponse(content={"filename": file.filename, "message": "File uploaded successfully."})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

import os
import io
import zipfile
from typing import Tuple
from fastapi import HTTPException, status

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

def validate_resume_file(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """
    Strictly validates uploaded resume files:
    - Rejects empty files.
    - Enforces maximum file size of 10MB.
    - Enforces allowed extensions: ONLY .pdf and .docx.
    - Explicitly rejects .doc, .txt, executables, scripts, images, arbitrary zips.
    - Inspects magic bytes / document structure:
      * PDF: must contain b"%PDF-" magic header in the first 1024 bytes.
      * DOCX: must be a valid zip archive containing [Content_Types].xml and word/document.xml.
    
    Returns (cleaned_filename, mime_type) if valid, or raises HTTPException(400).
    """
    if not filename or not filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume filename is required."
        )

    cleaned_filename = os.path.basename(filename.strip())
    ext = os.path.splitext(cleaned_filename)[1].lower()

    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded resume file is empty."
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size ({len(file_bytes)} bytes) exceeds the maximum allowed size of 10MB."
        )

    if ext not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Only real PDF (.pdf) and DOCX (.docx) files are accepted. Formats like .doc, .txt, .zip, and images are rejected."
        )

    if ext == ".pdf":
        # Validate PDF magic header within first 1024 bytes
        header = file_bytes[:1024]
        if b"%PDF-" not in header:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid PDF file. The file header does not contain valid PDF magic bytes (%PDF-)."
            )
        return cleaned_filename, "application/pdf"

    elif ext == ".docx":
        # Validate DOCX OpenXML Zip structure
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                names = zf.namelist()
                if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid DOCX file. Mandatory OpenXML document components ([Content_Types].xml or word/document.xml) are missing."
                    )
        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or invalid DOCX file. File is not a valid OpenXML zip archive."
            )
        return cleaned_filename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file format."
    )

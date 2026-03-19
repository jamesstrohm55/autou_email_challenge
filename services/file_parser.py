import pdfplumber
from io import BytesIO  
from fastapi import HTTPException

async def extract_text(filename: str, content: bytes) -> str:
    """Main entry point. Takes filename and raw bytes, returns extracted text."""
    
    #Get file extension
    ext = filename.rsplit('.', 1)[-1].lower() if "." in filename else ""
    
    #Route to the right extractor based on file type
    if ext == "txt":
        text = _extract_text_from_txt(content)
    elif ext == "pdf":
        text = _extract_text_from_pdf(content)
    else:
        raise HTTPException(400, "Unsupported file type. Please upload a .txt or a .pdf file.")
    
    #Guard against empty files
    if not text or not text.strip():
        raise HTTPException(400, "The uploaded file is empty or contains only whitespace.")
    
    return text

def _extract_text_from_txt(content: bytes) -> str:
    """Decode raw bytes to string. UTF-8 first, Latin-1 as a fallback."""
    try:
        return content.decode('utf-8')
    except UnicodeDecodeError:
        return content.decode('latin-1')  #Latin-1 can decode any byte sequence
    
def _extract_text_from_pdf(content: bytes) -> str:
    """Extract text from all pages of PDF file."""
    texts = []
    with pdfplumber.open(BytesIO(content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:       #Some pages may only contain images and no text, so we check for None
                texts.append(page_text)
                
    if not texts:
        #If no pages had text, it is probably a scanned/image only PDF which we can't handle
        raise HTTPException(400, "Could not extract any text from file.")
        
    return "\n".join(texts)  #Combine all pages with newlines betwenn them
    
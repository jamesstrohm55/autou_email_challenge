from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import os
import nltk


from services.file_parser import extract_text 
from services.preprocessor import preprocess_email
from services.classifier import classify_and_respond

load_dotenv()  #Load environment variables from .env file

app = FastAPI(title="Email Classifier")

# CORS middleware: allows the frontend (running on a different port/origin) to call our API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  #In production, specify your frontend URL instead of "*"
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)


app.mount("/static", StaticFiles(directory="static"), name="static")  #Serve static files like HTML/CSS/JS


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Download NLTK data on first run. Runs once when the server starts."""
    #Quiet=True suppresses download messages, we just want the data to be there for preprocessing, gets saved in nltk_data/ folder which is gitignored
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('omw-1.4', quiet=True)  #For lemmatizer language data
    yield  #Lifespan functions must be async generators, so we yield control back to FastAPI after setup 


@app.get("/")
async def root():
    """Serve the frontend HTML page."""
    return FileResponse("static/index.html")  #Serve the main HTML file for the frontend

@app.post("/api/classify")
async def classify_email(
    file: UploadFile = File(None),      #Optional file upload
    text: str = Form(None),             #Optional text field
):
    #Validate: at least one input required
    if file is None and text is None:
        raise HTTPException(400, "Please provide either a file or text input.")
    
    if file is not None:
        #File upload path
        content = await file.read()  #Read raw bytes from uploaded file
        if len(content) > 5 * 1024 * 1024:  #5MB size limit for uploads
            raise HTTPException(400, "File size exceeds 5MB limit.")
        raw_text = await extract_text(file.filename, content)  #Extract text from file
    else:
        #Direct text input path
        raw_text = text.strip()
        if not raw_text:
            raise HTTPException(400, "Text input cannot be empty.")
        
        
    #NLP pipeline: clean the text and create preprocessed version for better AI understanding
    result = preprocess_email(raw_text)
    
    #Send to AI for classification
    ai_result = await classify_and_respond(result["original_clean"], result["preprocessed"])
    
    #Return AI result plus some metadata about the text lengths for frontend display
    return {
        **ai_result,  #Classification, confidence, reasoning, suggested_reply from AI
        "original_length": len(result["original_clean"]), # How long the cleaned email was
        "preprocessed_length": len(result["preprocessed"]), # How long after stopword removal
    }
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
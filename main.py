from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import os
import nltk
import asyncio


from services.file_parser import extract_text 
from services.preprocessor import preprocess_email
from services.classifier import ClassifierError, classify_and_respond
from services.database import init_db, save_classification, get_stats, get_history

load_dotenv()  #Load environment variables from .env file

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Download NLTK data on first run. Runs once when the server starts."""
    #Quiet=True suppresses download messages, we just want the data to be there for preprocessing, gets saved in nltk_data/ folder which is gitignored
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('omw-1.4', quiet=True)  #For lemmatizer language data
    init_db()  #Initialize the SQLite database and create tables if they don't exist
    yield  #Lifespan functions must be async generators, so we yield control back to FastAPI after setup 

app = FastAPI(title="Email Classifier", lifespan=lifespan)  #Use the lifespan function to run setup code on startup

#Set up rate limiting: max 10 requests per minute per IP address to prevent abuse
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter  #Attach the limiter to the app state so we can use it in our endpoints

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    """Return a 429 Too Many Requests response when rate limit is exceeded."""
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )
    
@app.exception_handler(ClassifierError)
async def classifier_error_handler(request, exc):
    return JSONResponse(
        status_code=503,
        content={
            "detail": f"AI service unavailable: {exc.message}",
            "classification": "Error",
        }
    )


# CORS middleware: allows the frontend (running on a different port/origin) to call our API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  #In production, specify your frontend URL instead of "*"
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)


app.mount("/static", StaticFiles(directory="static"), name="static")  #Serve static files like HTML/CSS/JS

class BatchRequest(BaseModel):
    emails: list[str]  #List of raw email texts to classify in batch
    lang: str = "en"   #Language for AI response

@app.get("/")
async def root():
    """Serve the frontend HTML page."""
    return FileResponse("static/index.html")  #Serve the main HTML file for the frontend

@app.post("/api/classify")
@limiter.limit("10/minute")
async def classify_email(
    request: Request,
    file: UploadFile = File(None),      #Optional file upload
    text: str = Form(None),             #Optional text field
    lang: str = Form("en"),             #Language for AI response
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
    ai_result = await classify_and_respond(result["original_clean"], result["preprocessed"], lang)
    
    #Return AI result plus some metadata about the text lengths for frontend display
    response = {
        **ai_result,  #Classification, confidence, reasoning, suggested_reply from AI
        "original_length": len(result["original_clean"]), # How long the cleaned email was
        "preprocessed_length": len(result["preprocessed"]), # How long after stopword removal
    }
    
    save_classification(raw_text, response, ai_result.get("was_retried", False))  #Save the original input and AI result to the database for stats/dashboard
    
    return response

@app.post("/api/classify/batch")
@limiter.limit("5/minute")
async def classify_batch(request: Request, batch: BatchRequest):
    if not batch.emails:
        raise HTTPException(400, "Email list cannot be empty.")
    if len(batch.emails) > 20:
        raise HTTPException(400, "Batch size cannot exceed 20 emails.")
    
    async def process_one(email_text: str) -> dict:
        text = email_text.strip()
        if not text:
            return {"classification" : "Error", "reasoning": "Email text cannot be empty."}

        result = preprocess_email(text)
        ai_result = await classify_and_respond(result["original_clean"], result["preprocessed"], batch.lang)
        
        response = {
            **ai_result,
            "original_length": len(result["original_clean"]),
            "preprocessed_length": len(result["preprocessed"]),
        }
        
        save_classification(text, response, ai_result.get("was_retried", False))
        return response
    
    results = await asyncio.gather(*[process_one(email) for email in batch.emails])
    
    return {
        "count": len(results),
        "results": results,
    }
    
@app.get("/api/stats")
async def stats():
    """Return stats for dashboard"""
    return get_stats()

@app.get("/api/history")
async def history(limit: int = 20, offset: int = 0):
    """Return recent classification history for dashboard"""
    return get_history(limit, offset)

@app.get("/api/health")
async def health():
    import httpx
    
    #Check if OpenRouter API key exists 
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return {"status": "error", "message": "OPENROUTER_API_KEY not set in environment."}
    
    #check if OpenRouter API is reachable
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
        if response.status_code == 200:
            return {"status": "healthy", "openrouter": "connected"}
        else:
            return {"status": "unhealthy", "reason": f"OpenRouter returned {response.status_code}"}
    except Exception as e:
        return {"status": "unhealthy", "reason": f"Connection failed: {str(e)}"}
    
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
# AutoU Email Classifier

An email classification app for financial services. Upload or paste an email, and the AI classifies it as **Productive** or **Non-Productive** with a confidence score, reasoning, and suggested reply.

## Tech Stack

- **Backend**: FastAPI + Uvicorn
- **NLP**: NLTK (stopword removal, lemmatization)
- **AI**: OpenRouter API (Nvidia Nemotron model)
- **File Parsing**: pdfplumber for PDFs, UTF-8/Latin-1 for text files

## Setup

```bash
pip install -r requirements.txt
python -c "import nltk; nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('omw-1.4')"
```

Create a `.env` file (see `.env.example`):

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

## Run

```bash
python main.py
```

Server starts at `http://localhost:8000`.

## API

### POST /api/classify

Accepts either a file upload or text input via form data.

**Text input:**
```bash
curl -X POST http://localhost:8000/api/classify -F "text=Your email content here"
```

**File upload (.txt or .pdf):**
```bash
curl -X POST http://localhost:8000/api/classify -F "file=@email.txt"
```

**Response:**
```json
{
  "classification": "Productive",
  "confidence": "High",
  "reasoning": "The email requests an update on a compliance audit...",
  "suggested_reply": "Dear [Sender], Thank you for your request...",
  "original_length": 85,
  "preprocessed_length": 63
}
```

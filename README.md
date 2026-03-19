# AutoU Email Classifier

An email classification app for financial services. Upload or paste an email, and the AI classifies it as **Productive** or **Non-Productive** with a confidence score, reasoning, and suggested reply.

## Tech Stack

- **Backend**: FastAPI + Uvicorn
- **NLP**: NLTK (stopword removal, lemmatization)
- **AI**: OpenRouter API (Nvidia Nemotron model)
- **File Parsing**: pdfplumber for PDFs, UTF-8/Latin-1 for text files
- **Database**: SQLite for classification history and analytics

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

Classify a single email via text or file upload. Rate limited to 10 requests/minute.

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
  "was_retried": false,
  "original_length": 85,
  "preprocessed_length": 63
}
```

### POST /api/classify/batch

Classify up to 20 emails in a single request. Rate limited to 5 requests/minute.

```bash
curl -X POST http://localhost:8000/api/classify/batch -H "Content-Type: application/json" -d "{\"emails\": [\"Please send the Q4 audit report\", \"FLASH SALE 70% OFF!!!\"]}"
```

**Response:**
```json
{
  "count": 2,
  "results": [
    {"classification": "Productive", "confidence": "High", "...": "..."},
    {"classification": "Non-Productive", "confidence": "High", "...": "..."}
  ]
}
```

### GET /api/health

Check API key and OpenRouter connectivity.

```bash
curl http://localhost:8000/api/health
```

### GET /api/stats

View classification statistics and breakdowns.

```bash
curl http://localhost:8000/api/stats
```

### GET /api/history

View recent classifications with optional pagination.

```bash
curl http://localhost:8000/api/history
curl "http://localhost:8000/api/history?limit=5&offset=0"
```

## Features

- **NLP Preprocessing**: Email header removal, text cleaning, stopword removal, lemmatization
- **Confidence Retry**: Low-confidence classifications are automatically retried with a more detailed prompt
- **Batch Processing**: Classify up to 20 emails in parallel with a single API call
- **Analytics**: SQLite-backed classification history with stats dashboard endpoint
- **Rate Limiting**: 10 req/min for single classify, 5 req/min for batch
- **Error Handling**: Proper HTTP status codes (400 bad input, 429 rate limited, 503 AI unavailable)

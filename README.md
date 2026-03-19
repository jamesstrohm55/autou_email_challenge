# AutoU Email Classifier

An email classification app for financial services. Upload or paste an email, and the AI classifies it as **Productive** or **Non-Productive** with a confidence score, reasoning, and suggested reply.

## Tech Stack

- **Backend**: FastAPI + Uvicorn
- **Frontend**: Plain HTML/CSS/JS (no build tools)
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

## Frontend

A single-page app served at `http://localhost:8000` with four tabs:

- **Classify** — Paste email text or drag-and-drop a `.txt`/`.pdf` file for classification
- **Batch** — Classify multiple emails at once, separated by a configurable delimiter
- **History** — Paginated table of past classifications
- **Dashboard** — Stats cards and bar charts showing classification/confidence breakdowns

The UI includes a live health indicator, toast notifications, loading spinners, color-coded results (green for Productive, red for Non-Productive), confidence badges, and a copy button for suggested replies.

## Features

- **NLP Preprocessing**: Email header removal, text cleaning, stopword removal, lemmatization
- **Confidence Retry**: Low-confidence classifications are automatically retried with a more detailed prompt
- **Batch Processing**: Classify up to 20 emails in parallel with a single API call
- **Analytics**: SQLite-backed classification history with stats dashboard endpoint
- **Rate Limiting**: 10 req/min for single classify, 5 req/min for batch
- **Error Handling**: Proper HTTP status codes (400 bad input, 429 rate limited, 503 AI unavailable)
- **File Upload**: Drag-and-drop or browse for `.txt` and `.pdf` files (5MB limit)
- **Responsive UI**: Mobile-friendly layout with card-based design
- **CSV Export**: Download classification history as a CSV file
- **Keyboard Shortcuts**: Ctrl+Enter to classify
- **Try Examples**: Pre-loaded sample emails for quick demos
- **Animated Dashboard**: Counting animations, animated bar charts, skeleton loading

## Live Demo

Deployed on Render: **[URL will be added after deploy]**

## Deployment

This app is configured for Render.com deployment via `render.yaml`. To deploy:

1. Push to a public GitHub repo
2. Connect the repo on [Render Dashboard](https://dashboard.render.com)
3. Set the `OPENROUTER_API_KEY` environment variable
4. Deploy — NLTK data downloads automatically during build

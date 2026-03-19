import re
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer


def preprocess_email(text: str) -> dict:
    """Pipeline: remove headers -> clean -> lemmatize -> return dict with cleaned text and word count."""
    no_headers = _remove_email_headers(text)
    cleaned = _clean_text(no_headers)
    preprocessed = _remove_stopwords_and_lemmatize(cleaned)
    return {"original_clean": cleaned, "preprocessed": preprocessed}

def _remove_email_headers(text: str) -> str:
    """Strip metadata lines like 'From: john@' that does not contribute to email body content."""
    return re.sub(
        r"^(From|To|Subject|Date|Cc|Bcc|Reply-To|Message-ID|In-Reply-To|References): .*$",
        "",
        text,
        flags=re.MULTILINE | re.IGNORECASE  
    )
    
def _clean_text(text: str) -> str:
    """Normalize text: lowercase, remove URLs, emails, punctuation, and extra whitespace."""
    text = text.lower()
    text = re.sub(r"http\S+|www\S+|https\S+", "", text)  #Remove URLs
    text = re.sub(r"\S+@\S+", "", text)  #Remove email addresses
    text = re.sub(r"[^\w\s]", "", text)  #Remove punctuation
    text = re.sub(r"\s+", " ", text).strip()  #Collapse multiple
    return text

def _remove_stopwords_and_lemmatize(text: str) -> str:
    """Remove common Englihs words and reduce remaining words to their base forms."""
    stop_words = set(stopwords.words('english'))
    lemmatizer = WordNetLemmatizer()
    tokens = text.split()
    result = [
        lemmatizer.lemmatize(word)
        for word in tokens
        if word not in stop_words and word.isalpha()  #Keep only alphabetic words
    ]
    return " ".join(result)



import os
import re
import json

#System prompt tells AI what role to play and how to format it's respnse
SYSTEM_PROMPT = """You are an email classifier for a financial services company.
Classify incoming emails into one of the following categories: "Productive" or "Non-Productive". 

Productive emails: Client requestrs, transaction inquiries, compliance questions, 
account updates, meeting requests about buisness, financial reports, regulatory matters

Non-Productive emails: spam, phishing, personal messages, neewsletters, holiday grettings,
social invitations, jokes, memes, chain letters, non-business related content, promotional offers, irrelevant content

Respond ONLY wioth valid JSON in this exact format:
{
    "classification": "Productive" or "Non-Productive",
    "confidence": "High", "Medium", or "Low",
    "reasoning": "Brief explanation of why",
    "suggested_reply": "A professional reply to this email"
}"""

DETAILED_PROMPT = """You are an email classifier for a financial services company. A previous classification attempt returned
"Unknown" with "Low" confidence. Please analyze the email content and provide a more detailed classification.

Classify the email as "Productive" or "Non-Productive".

Productive indicators:
- Mentions specific account numbers, clients, or transactions
- Requests action on buisness matters (audits, reports, compliance)
- Discusses financial data, regulations, or deadlines
- Scheduling meetings about work topics

Non-Productive indicators:
- No buisness content whatsoever
- Purely social, personal or promotional content
- Spam, phishing, chain letters
- Newsletters, jokes, memes, irrelevant content

If the email mixes both personal and buisness content, classify based on the PRIMARY intent.

REspond ONLY with valid JSON in this exact format:
{
    "classification": "Productive" or "Non-Productive",
    "confidence": "High", "Medium", or "Low",
    "reasoning": "Brief explaination of why",
    "suggested_reply": "A professional reply to this email"
}"""

class ClassifierError(Exception):
    def __init__(self, message: str):
        self.message = message


LANG_INSTRUCTIONS = {
    "pt-BR": '\n\nIMPORTANT: Write the "reasoning" and "suggested_reply" fields in Brazilian Portuguese (PT-BR). The "classification" and "confidence" fields must remain in English.',
}

async def classify_and_respond(original_text: str, preprocessed_text: str, lang: str = "en") -> dict:
    """Classify an email. If confidence is Low, retry with a more detailed prompt to try to get a better result."""
    lang_suffix = LANG_INSTRUCTIONS.get(lang, "")
    try:
        result = await _call_ai(original_text, preprocessed_text, SYSTEM_PROMPT + lang_suffix)
    except ClassifierError:
        raise

    was_retried = False

    if result.get("confidence") == "Low" and result.get("classification") not in ("Error", "Unknown"):
        try:
            retry_result = await _call_ai(original_text, preprocessed_text, DETAILED_PROMPT + lang_suffix)
            if retry_result.get("classification") not in ("Error", "Unknown"):
                result = retry_result
                was_retried = True
        except ClassifierError:
            pass # Keep the original low confidence result if the retry also fails

    result["was_retried"] = was_retried  #Add this flag to the result for database logging
    return result

async def _call_ai(original_text: str, preprocessed_text: str, system_prompt: str) -> dict:
    """Make a single API call to OpenRouter with the given system prompt and user content, return the parsed response as a dict."""
    import httpx
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "nvidia/nemotron-3-nano-30b-a3b:free",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Original email:\n{original_text}\n\nPreprocessed keywords:\n{preprocessed_text}"}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1024
                },
                timeout=30,
            )

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            if not content:
                return
            
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                match = re.search(r"\{[\s\S]*\}", content)
                if match:
                    try:
                        return json.loads(match.group())
                    except json.JSONDecodeError:
                        pass
            
            return {
                "classification": "Unknown",
                "confidence": "Low",
                "reasoning": content,
                "suggested_reply": "Unable to generate a suggested reply due to parsing issues."
            }
            
    except Exception as e:
        #Catch any API errors
        raise ClassifierError(str(e))
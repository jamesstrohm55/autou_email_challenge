import os
import re
import json
from openai import OpenAI

#System prompt tells AI what role to play and how to format it's respnse
SYSTEM_PROMPT = """You are an email classifier for a financial services company.
Classify incoming emails into one of the following categories: "Productive" or "Non-Productive". 

Productive emails: client requestrs, transaction inquiries, compliance questions, 
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


async def classify_and_respond(original_text: str, preprocesssed_text: str) -> dict:
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
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"Original email:\n{original_text}\n\nPreprocessed keywords:\n{preprocesssed_text}"}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1024
                },
                timeout=30,
            )

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            if not content:
                return {
                    "classification": "Unknown",
                    "confidence": "Low",
                    "reasoning": "No response content received from AI. Try again",
                    "suggested_reply": "Unable to generate a suggested reply due to lack of response content."
                }
            
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
        return {
            "classification": "Error",
            "confidence": "Low",
            "reasoning": f"API Error: {str(e)}",
            "suggested_reply": "Unable to generate a suggested reply due to an error."
        }
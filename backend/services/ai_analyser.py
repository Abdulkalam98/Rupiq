"""AI Analysis Engine — Gemini-powered financial analysis across all statement types."""

import json
import os

import google.generativeai as genai

from services.supabase_client import get_supabase

_gemini_model = None


def _get_gemini():
    global _gemini_model
    if _gemini_model is None:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        _gemini_model = genai.GenerativeModel("gemini-2.0-flash")
    return _gemini_model

ANALYSIS_SYSTEM_PROMPT = """You are Rupiq's AI financial analyst for Indian consumers. You receive parsed transaction data from bank statements, credit card statements, demat/brokerage statements, and CIBIL credit reports.

Your job: analyse everything together and return a single unified financial picture.

STATEMENT TYPES YOU MAY RECEIVE:
- BANK: regular income/expense transactions (salary, UPI, EMIs, etc.)
- CREDIT_CARD: card spend, interest charges, minimum dues, reward points
- DEMAT: holdings value, gains/losses, SIP transactions, dividend income
- CIBIL: credit score, active loans, credit utilization percentage

ANALYSIS RULES:
1. Financial Health Score (0-100): weighted across all statement types present
2. Top 1 Action: the single most impactful thing the user should do RIGHT NOW
3. Keep language simple, direct, in Indian context (use ₹, lakh, crore)
4. Cross-statement insights are the MOST valuable — e.g.:
   - "Your SIP returns (12%) are lower than your credit card interest (36%) — redirect SIP to clear card first"
   - "Your demat portfolio has ₹45,000 liquid — enough to clear your personal loan"
   - "Your CIBIL score dropped because credit utilization is 78% — pay down HDFC card by ₹15,000"
5. Never be vague. Use exact numbers from the data.
6. Flag EMIs, interest charges, and subscriptions explicitly.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "financial_score": 0-100,
  "top_action": "Single most important action in 1 sentence",
  "summary": {
    "total_income": number,
    "total_expenses": number,
    "total_investments": number,
    "savings_rate": "percentage string",
    "credit_utilization": "percentage string or null",
    "net_worth_estimate": number or null
  },
  "insights": [
    {
      "type": "warning|positive|neutral",
      "title": "Short title",
      "detail": "Explanation with exact numbers",
      "category": "spending|income|debt|investment|credit"
    }
  ],
  "cross_statement_insights": [
    {
      "insight": "Cross-statement observation",
      "action": "Specific recommendation",
      "annual_saving": number or null
    }
  ],
  "spending_breakdown": {
    "category_name": number
  },
  "monthly_trend": {
    "income_trend": "increasing|stable|decreasing",
    "expense_trend": "increasing|stable|decreasing",
    "verdict": "1-line summary"
  }
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON."""


async def analyse_statements(user_id: str, upload_ids: list[str]) -> dict:
    """Run Gemini analysis on one or more parsed statements."""
    sb = get_supabase()

    # Fetch all transactions for these uploads
    all_transactions = []
    statement_types_found = set()

    for upload_id in upload_ids:
        # Get upload metadata
        upload = (
            sb.table("pdf_uploads")
            .select("*")
            .eq("id", upload_id)
            .single()
            .execute()
        )
        if upload.data:
            statement_types_found.add(upload.data.get("statement_type", "bank"))

        # Get transactions
        txs = (
            sb.table("transactions")
            .select("*")
            .eq("upload_id", upload_id)
            .execute()
        )
        if txs.data:
            all_transactions.extend(txs.data)

    if not all_transactions:
        return {"error": "No transactions found for the given uploads"}

    # Build the prompt with transaction data
    tx_summary = []
    for tx in all_transactions:
        tx_summary.append(
            {
                "description": tx.get("description", ""),
                "amount": float(tx.get("amount", 0)),
                "type": tx.get("type", "debit"),
                "category": tx.get("category", "other"),
                "is_emi": tx.get("is_emi", False),
                "is_interest": tx.get("is_interest", False),
                "statement_type": tx.get("statement_type", "bank"),
            }
        )

    user_prompt = f"""Analyse these financial transactions for an Indian user.

Statement types present: {', '.join(statement_types_found)}
Total transactions: {len(tx_summary)}

Transaction data:
{json.dumps(tx_summary, indent=2)}

Provide your complete analysis in the JSON format specified."""

    # Call Gemini
    response = _get_gemini().generate_content(
        [ANALYSIS_SYSTEM_PROMPT, user_prompt],
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )

    # Parse Gemini response
    try:
        analysis = json.loads(response.text)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        text = response.text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            analysis = json.loads(text[start:end])
        else:
            return {"error": "Failed to parse AI response"}

    # Save analysis result to DB
    result = (
        sb.table("analysis_results")
        .insert(
            {
                "user_id": user_id,
                "upload_ids": upload_ids,
                "financial_score": analysis.get("financial_score"),
                "top_action": analysis.get("top_action"),
                "summary": analysis.get("summary"),
                "insights": analysis.get("insights"),
                "cross_statement_insights": analysis.get("cross_statement_insights"),
                "spending_breakdown": analysis.get("spending_breakdown"),
                "monthly_trend": analysis.get("monthly_trend"),
            }
        )
        .execute()
    )

    analysis["analysis_id"] = result.data[0]["id"]

    # Update upload statuses to "analysed"
    for upload_id in upload_ids:
        sb.table("pdf_uploads").update({"status": "analysed"}).eq(
            "id", upload_id
        ).execute()

    return analysis

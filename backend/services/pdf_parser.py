"""PDF parser — extracts transactions from bank/CC/demat/CIBIL statement PDFs."""

import io
import re
import pdfplumber


# ── Transaction categorization ────────────────────────────────

CATEGORY_RULES = {
    "salary": ["salary", "payroll", "wage", "income"],
    "rent": ["rent", "house rent", "hra"],
    "emi": ["emi", "loan", "equated monthly"],
    "groceries": ["grocery", "grocer", "bigbasket", "blinkit", "zepto", "dmart", "swiggy instamart"],
    "food": ["swiggy", "zomato", "restaurant", "cafe", "food", "dominos", "mcdonald"],
    "transport": ["uber", "ola", "rapido", "petrol", "diesel", "fuel", "metro", "irctc"],
    "shopping": ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa"],
    "utilities": ["electricity", "water", "gas", "broadband", "wifi", "jio", "airtel", "vi ", "bsnl"],
    "insurance": ["insurance", "lic", "premium", "policy"],
    "investment": ["sip", "mutual fund", "mf ", "zerodha", "groww", "upstox", "nps", "ppf"],
    "medical": ["hospital", "medical", "pharmacy", "apollo", "medplus", "doctor", "health"],
    "entertainment": ["netflix", "hotstar", "prime video", "spotify", "movie", "pvr", "inox"],
    "education": ["school", "college", "tuition", "course", "udemy", "unacademy"],
    "transfer": ["upi", "neft", "rtgs", "imps", "transfer", "self transfer"],
    "atm": ["atm", "cash withdrawal", "cash deposit"],
}


def categorize(description: str) -> str:
    desc_lower = description.lower()
    for category, keywords in CATEGORY_RULES.items():
        if any(kw in desc_lower for kw in keywords):
            return category
    return "other"


def is_emi(description: str) -> bool:
    return bool(re.search(r"\bemi\b|equated monthly|loan\s*(?:repay|instal)", description, re.I))


def is_interest(description: str) -> bool:
    return bool(re.search(r"interest\s*(?:charge|paid|debit)|finance charge|late.*fee", description, re.I))


# ── Bank detection ────────────────────────────────────────────

BANK_PATTERNS = {
    "HDFC Bank": ["hdfc bank", "hdfcbank"],
    "ICICI Bank": ["icici bank", "icicibank"],
    "SBI": ["state bank of india", "sbi "],
    "Axis Bank": ["axis bank", "axisbank"],
    "Kotak Bank": ["kotak mahindra", "kotak bank"],
    "Yes Bank": ["yes bank"],
    "IndusInd Bank": ["indusind"],
    "HDFC Credit Card": ["hdfc.*credit card", "hdfcbank.*card"],
    "ICICI Credit Card": ["icici.*credit card"],
    "SBI Card": ["sbi card", "sbicard"],
    "American Express": ["american express", "amex"],
    "Zerodha": ["zerodha", "kite"],
    "Groww": ["groww"],
    "Upstox": ["upstox"],
    "CIBIL": ["cibil", "transunion"],
}


def detect_bank(raw_text: str) -> str:
    text_lower = raw_text.lower()
    for bank, patterns in BANK_PATTERNS.items():
        if any(re.search(p, text_lower) for p in patterns):
            return bank
    return "Unknown"


# ── Statement type detection (for manual uploads) ────────────

def detect_statement_type_from_pdf(parse_result: dict) -> str:
    text = parse_result.get("raw_text", "").lower()
    if any(w in text for w in ["demat", "holding", "portfolio", "equity", "zerodha", "groww"]):
        return "demat"
    if any(w in text for w in ["credit card", "card number", "minimum amount due", "payment due"]):
        return "credit_card"
    if any(w in text for w in ["cibil", "credit score", "credit report", "transunion"]):
        return "cibil"
    return "bank"


# ── Core parser ───────────────────────────────────────────────

def _extract_transactions(pdf_file, statement_type: str = None) -> dict:
    """Shared extraction logic for both file paths and BytesIO objects."""
    transactions = []
    raw_text = ""

    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            raw_text += page.extract_text() or ""
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or len(row) < 3:
                        continue
                    try:
                        row_text = " ".join([str(c) for c in row if c])
                        amounts = re.findall(r"[\d,]+\.\d{2}", row_text)
                        if not amounts:
                            continue
                        amount = float(amounts[-1].replace(",", ""))
                        tx_type = (
                            "credit"
                            if any(w in row_text.lower() for w in ["cr", "credit", "deposit"])
                            else "debit"
                        )
                        description = row_text[:100]
                        transactions.append(
                            {
                                "description": description,
                                "amount": amount,
                                "type": tx_type,
                                "category": categorize(description),
                                "is_emi": is_emi(description),
                                "is_interest": is_interest(description),
                                "statement_type": statement_type or "bank",
                            }
                        )
                    except Exception:
                        continue

    return {
        "bank_name": detect_bank(raw_text),
        "raw_text": raw_text,
        "transactions": transactions,
        "transaction_count": len(transactions),
    }


def parse_pdf_file(file_path: str, statement_type: str = None) -> dict:
    """Parse PDF from a file path — used for manual uploads."""
    return _extract_transactions(file_path, statement_type)


def parse_pdf_bytes(pdf_bytes: io.BytesIO, statement_type: str = None) -> dict:
    """Parse PDF from in-memory bytes — used for Gmail auto-extracted PDFs."""
    return _extract_transactions(pdf_bytes, statement_type)

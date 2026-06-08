import re


def redact_sensitive_text(text):
    text = text or ""

    text = re.sub(r"\b[\w\.-]+@[\w\.-]+\.\w+\b", "[EMAIL]", text)
    text = re.sub(r"\b(?:\+34\s?)?\d{9}\b", "[TELEFONO]", text)
    text = re.sub(r"\b\d{8}[A-Z]\b", "[DNI]", text, flags=re.IGNORECASE)
    text = re.sub(r"\b[XYZ]\d{7}[A-Z]\b", "[NIE]", text, flags=re.IGNORECASE)
    text = re.sub(r"\bES[-_]?[A-Z0-9]{3,}\b", "[CROTAL]", text, flags=re.IGNORECASE)

    personal_terms = [
        "mi hijo", "mi hija", "mi padre", "mi madre", "mi hermano", "mi hermana",
        "mi mujer", "mi marido", "mi vecino", "mi vecina", "el pastor",
        "la pastora", "el empleado", "la empleada"
    ]
    for term in personal_terms:
        text = re.sub(rf"\b{re.escape(term)}\b", "[PERSONA]", text, flags=re.IGNORECASE)

    return text.strip()

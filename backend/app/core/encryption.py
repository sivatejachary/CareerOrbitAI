import base64
import hashlib
import json
from typing import Any, Dict
from cryptography.fernet import Fernet
from backend.app.config import settings

def _get_fernet_key() -> bytes:
    if settings.TOKEN_ENCRYPTION_KEY and len(settings.TOKEN_ENCRYPTION_KEY.strip()) >= 32:
        key_str = settings.TOKEN_ENCRYPTION_KEY.strip()
        # If key is already valid fernet key (32 url-safe base64 bytes)
        try:
            Fernet(key_str.encode("utf-8"))
            return key_str.encode("utf-8")
        except Exception:
            pass
        # Derive 32-byte key from string
        hashed = hashlib.sha256(key_str.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(hashed)

    # Fallback to deterministic key derived from JWT_SECRET
    hashed = hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(hashed)

def encrypt_dict(data: Dict[str, Any]) -> str:
    fernet = Fernet(_get_fernet_key())
    raw_bytes = json.dumps(data).encode("utf-8")
    encrypted = fernet.encrypt(raw_bytes)
    return encrypted.decode("utf-8")

def decrypt_dict(cipher_text: str) -> Dict[str, Any]:
    if not cipher_text:
        return {}
    fernet = Fernet(_get_fernet_key())
    decrypted_bytes = fernet.decrypt(cipher_text.encode("utf-8"))
    return json.loads(decrypted_bytes.decode("utf-8"))

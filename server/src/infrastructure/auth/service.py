"""Authentication service for token management."""
import json
import logging
import secrets
import time
from pathlib import Path
from dataclasses import dataclass


logger = logging.getLogger(__name__)


@dataclass
class QRToken:
    """Temporary QR token with expiration."""
    token: str
    expires_at: float
    used: bool = False


class AuthService:
    """Handles token persistence and validation."""
    
    DEFAULT_QR_TTL_SECONDS = 60
    
    def __init__(self, token_store_path: Path):
        self._token_store_path = token_store_path
        self._tokens: set[str] = set()
        self._qr_tokens: dict[str, QRToken] = {}
        self._current_qr_token: str | None = None
        self._load_tokens()
    
    def _load_tokens(self) -> None:
        """Load tokens from disk."""
        if self._token_store_path.exists():
            try:
                with open(self._token_store_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._tokens = set(data.get("tokens", []))
                    logger.info(f"Loaded {len(self._tokens)} auth token(s)")
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load tokens: {e}")
                self._tokens = set()
        else:
            self._token_store_path.parent.mkdir(parents=True, exist_ok=True)
    
    def _save_tokens(self) -> None:
        """Persist tokens to disk."""
        with open(self._token_store_path, "w", encoding="utf-8") as f:
            json.dump({"tokens": list(self._tokens)}, f, indent=2)
    
    def issue_token(self) -> str:
        """Generate and persist a new session token."""
        token = secrets.token_hex(16)
        self._tokens.add(token)
        self._save_tokens()
        logger.info(f"New session token issued: {token[:8]}...")
        return token
    
    def validate_token(self, token: str | None) -> bool:
        if token is None:
            return False
        return token in self._tokens
    
    def revoke_token(self, token: str) -> bool:
        """Returns True if token existed and was revoked."""
        if token in self._tokens:
            self._tokens.discard(token)
            self._save_tokens()
            logger.info(f"Token revoked: {token[:8]}...")
            return True
        return False
    
    # === QR Token Management ===
    
    def issue_qr_token(self, ttl_seconds: int | None = None) -> str:
        """
        Generate a temporary QR token.
        Invalidates the previous QR token if one exists.
        """
        if ttl_seconds is None:
            ttl_seconds = self.DEFAULT_QR_TTL_SECONDS
        
        if self._current_qr_token:
            self._qr_tokens.pop(self._current_qr_token, None)
        
        token = secrets.token_hex(16)
        expires_at = time.time() + ttl_seconds
        self._qr_tokens[token] = QRToken(token=token, expires_at=expires_at)
        self._current_qr_token = token
        
        logger.info(f"QR token issued: {token[:8]}... (TTL: {ttl_seconds}s)")
        return token
    
    def exchange_qr_token(self, qr_token: str) -> str | None:
        """
        Exchange a valid QR token for a session token.
        Returns None if QR token is invalid, expired, or already used.
        """
        qr_data = self._qr_tokens.get(qr_token)
        
        if not qr_data:
            logger.warning(f"QR token exchange failed: token not found")
            return None
        
        if qr_data.used:
            logger.warning(f"QR token exchange failed: already used")
            return None
        
        if time.time() > qr_data.expires_at:
            logger.warning(f"QR token exchange failed: expired")
            self._qr_tokens.pop(qr_token, None)
            return None
        
        qr_data.used = True
        self._qr_tokens.pop(qr_token, None)
        
        session_token = self.issue_token()
        logger.info(f"QR token exchanged for session: {qr_token[:8]}... -> {session_token[:8]}...")
        return session_token
    
    def cleanup_expired_qr_tokens(self) -> int:
        """Remove expired QR tokens. Returns count of removed tokens."""
        now = time.time()
        expired = [t for t, data in self._qr_tokens.items() if now > data.expires_at]
        for token in expired:
            self._qr_tokens.pop(token, None)
        if expired:
            logger.debug(f"Cleaned up {len(expired)} expired QR token(s)")
        return len(expired)


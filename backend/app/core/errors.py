from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class ArielException(Exception):
    """Base domain exception for ARIEL backend."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class DatasetNotFoundError(ArielException):
    """Raised when a requested dataset does not exist."""
    pass


class InvalidCoordinateError(ArielException):
    """Raised when coordinates exceed physical boundary limits."""
    pass


class ScientificComputationError(ArielException):
    """Raised when thermodynamic/fluid-dynamics computation fails."""
    pass


class IngestionError(ArielException):
    """Raised when file parsing or format validation fails."""
    pass


class DataProviderUnavailableError(ArielException):
    """Raised when an external or local scientific data provider cannot supply the requested product."""
    def __init__(self, message: str, source: str, retryable: bool = True, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, details)
        self.source = source
        self.retryable = retryable


def to_http_exception(exc: ArielException) -> HTTPException:
    """Map domain exceptions to standard HTTP status codes."""
    from datetime import datetime, timezone
    if isinstance(exc, DatasetNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "DatasetNotFound", "message": exc.message, "details": exc.details},
        )
    elif isinstance(exc, InvalidCoordinateError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "InvalidCoordinates", "message": exc.message, "details": exc.details},
        )
    elif isinstance(exc, IngestionError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "IngestionFailure", "message": exc.message, "details": exc.details},
        )
    elif isinstance(exc, DataProviderUnavailableError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unavailable",
                "message": exc.message,
                "source": exc.source,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "retryable": exc.retryable,
                "details": exc.details,
            },
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"error": "InternalScientificError", "message": exc.message, "details": exc.details},
    )


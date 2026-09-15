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


def to_http_exception(exc: ArielException) -> HTTPException:
    """Map domain exceptions to standard HTTP status codes."""
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
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"error": "InternalScientificError", "message": exc.message, "details": exc.details},
    )

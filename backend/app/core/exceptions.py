from fastapi import HTTPException, status


class CashFlowException(HTTPException):
    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(status_code=status_code, detail=detail)


class NotFoundException(CashFlowException):
    def __init__(self, entity: str = "Resource"):
        super().__init__(detail=f"{entity} not found", status_code=status.HTTP_404_NOT_FOUND)


class AlreadyExistsException(CashFlowException):
    def __init__(self, entity: str = "Resource"):
        super().__init__(detail=f"{entity} already exists", status_code=status.HTTP_409_CONFLICT)


class UnauthorizedException(CashFlowException):
    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(detail=detail, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenException(CashFlowException):
    def __init__(self, detail: str = "Not enough permissions"):
        super().__init__(detail=detail, status_code=status.HTTP_403_FORBIDDEN)


class InvalidDateRangeException(CashFlowException):
    def __init__(self):
        super().__init__(detail="Invalid date range: start_date must be before end_date")


class NegativeAmountException(CashFlowException):
    def __init__(self):
        super().__init__(detail="Amount must be positive")

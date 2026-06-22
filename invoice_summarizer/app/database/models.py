"""
Dataclass models mirroring the SQLite schema.
Each field matches a column; Optional fields default to None.
"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass
class Category:
    id: Optional[int] = None
    name: str = ""
    description: Optional[str] = None
    color: Optional[str] = None           # hex e.g. "#4A90E2"
    icon: Optional[str] = None            # icon name for UI
    parent_id: Optional[int] = None       # supports subcategories
    ai_keywords: Optional[str] = None     # JSON array for AI classification
    created_at: Optional[datetime] = None


@dataclass
class Supplier:
    id: Optional[int] = None
    canonical_name: str = ""
    normalized_key: str = ""              # lowercase + stripped for matching
    category_id: Optional[int] = None
    country: Optional[str] = None
    vat_number: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class SupplierAlias:
    id: Optional[int] = None
    supplier_id: int = 0
    alias: str = ""
    source: str = "detected"             # "detected" | "manual"
    confidence: float = 1.0


@dataclass
class Invoice:
    id: Optional[int] = None
    supplier_id: Optional[int] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    currency: str = "SEK"
    subtotal: Optional[float] = None
    vat_total: Optional[float] = None
    grand_total: Optional[float] = None
    original_path: str = ""
    copy_path: str = ""
    file_hash: str = ""
    source_pdf_hash: Optional[str] = None   # SHA256 of the source PDF (multi-invoice)
    kid_number: Optional[str] = None         # Norwegian KID payment reference
    status: str = "pending"              # pending|processed|review|error
    error_message: Optional[str] = None
    raw_text: Optional[str] = None
    imported_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None


@dataclass
class Product:
    id: Optional[int] = None
    canonical_name: str = ""
    normalized_key: str = ""
    category: Optional[str] = None
    unit: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class ProductAlias:
    id: Optional[int] = None
    product_id: int = 0
    alias: str = ""
    source: str = "detected"


@dataclass
class LineItem:
    id: Optional[int] = None
    invoice_id: int = 0
    product_id: Optional[int] = None
    raw_description: str = ""
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None
    vat_rate: Optional[float] = None
    vat_amount: Optional[float] = None
    length_per_unit: Optional[float] = None
    total_length: Optional[float] = None
    confidence: float = 1.0
    needs_review: bool = False


@dataclass
class AggregatedPurchase:
    id: Optional[int] = None
    supplier_id: int = 0
    product_id: int = 0
    total_quantity: float = 0.0
    total_net: float = 0.0
    total_vat: float = 0.0
    total_gross: float = 0.0
    invoice_count: int = 0
    first_seen: Optional[date] = None
    last_seen: Optional[date] = None
    updated_at: Optional[datetime] = None


@dataclass
class CategoryAggregation:
    id: Optional[int] = None
    category_id: int = 0
    period_year: int = 0
    period_month: Optional[int] = None   # None = annual summary
    total_net: float = 0.0
    total_vat: float = 0.0
    total_gross: float = 0.0
    invoice_count: int = 0
    supplier_count: int = 0
    updated_at: Optional[datetime] = None


@dataclass
class ReviewQueueItem:
    id: Optional[int] = None
    invoice_id: Optional[int] = None
    line_item_id: Optional[int] = None
    issue_type: str = ""
    # low_confidence_supplier | unmatched_product |
    # duplicate_invoice | parse_error | missing_field
    description: Optional[str] = None
    suggestion: Optional[str] = None
    resolved: bool = False
    resolution: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

"""
AI classification hook interfaces.

Provides base classes that future AI/ML integrations can implement.
All methods return None by default (no-op), keeping the pipeline
functional before any AI backend is wired up.

To add an AI backend:
  1. Subclass AIClassificationHook
  2. Override the desired methods
  3. Register the subclass via Pipeline.set_ai_hook()
"""
from __future__ import annotations

from typing import Optional


class AIClassificationHook:
    """
    Base hook for AI-driven classification.
    All methods are no-ops; override selectively in subclasses.
    """

    def classify_supplier_category(
        self, supplier_name: str, context: dict
    ) -> Optional[str]:
        """
        Return a category name for the given supplier, or None to skip.
        context may include: invoice_text, line_items, country.
        """
        return None

    def classify_product_category(
        self, product_name: str, context: dict
    ) -> Optional[str]:
        """Return a category name for the given product, or None to skip."""
        return None

    def normalize_supplier_name(
        self, raw_name: str, context: dict
    ) -> Optional[str]:
        """Return a normalized canonical name, or None to use rule-based fallback."""
        return None

    def suggest_product_merge(
        self, product_a: str, product_b: str
    ) -> Optional[float]:
        """
        Return a confidence score 0–1 that product_a and product_b are the same,
        or None to fall back to fuzzy string matching.
        """
        return None


class NullAIHook(AIClassificationHook):
    """Explicit no-op hook. Used as default when AI is disabled."""


# Default hook used by the pipeline when AI_CLASSIFICATION_ENABLED = False
_default_hook: AIClassificationHook = NullAIHook()


def get_hook() -> AIClassificationHook:
    return _default_hook


def set_hook(hook: AIClassificationHook) -> None:
    global _default_hook
    _default_hook = hook

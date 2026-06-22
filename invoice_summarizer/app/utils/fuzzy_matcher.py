"""Fuzzy string matching wrapper — Phase 3 implementation."""


class FuzzyMatcher:
    def score(self, a: str, b: str) -> float:
        raise NotImplementedError("Fuzzy matching implemented in Phase 3")

    def best_match(self, query: str, candidates: list[str]) -> tuple[str, float]:
        raise NotImplementedError("Fuzzy matching implemented in Phase 3")

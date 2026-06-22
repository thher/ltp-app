"""Aggregation engine — Phase 4 implementation."""


class Aggregator:
    def update(self, invoice_id: int) -> None:
        raise NotImplementedError("Aggregation implemented in Phase 4")

    def rebuild_all(self) -> None:
        raise NotImplementedError("Aggregation implemented in Phase 4")

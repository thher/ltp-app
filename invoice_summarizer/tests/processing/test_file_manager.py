"""Tests for FileManager — SHA256 hashing and copy-on-import."""
import hashlib
import shutil

import pytest

from app.utils.file_manager import FileManager


class TestComputeHash:
    def test_returns_sha256_hex(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_bytes(b"hello")
        expected = hashlib.sha256(b"hello").hexdigest()
        assert FileManager(tmp_path).compute_hash(f) == expected

    def test_same_content_same_hash(self, tmp_path):
        a = tmp_path / "a.pdf"
        b = tmp_path / "b.pdf"
        a.write_bytes(b"content")
        b.write_bytes(b"content")
        fm = FileManager(tmp_path)
        assert fm.compute_hash(a) == fm.compute_hash(b)

    def test_different_content_different_hash(self, tmp_path):
        a = tmp_path / "a.pdf"
        b = tmp_path / "b.pdf"
        a.write_bytes(b"aaa")
        b.write_bytes(b"bbb")
        fm = FileManager(tmp_path)
        assert fm.compute_hash(a) != fm.compute_hash(b)

    def test_large_file(self, tmp_path):
        f = tmp_path / "big.bin"
        data = b"x" * (200 * 1024)   # 200 KB
        f.write_bytes(data)
        expected = hashlib.sha256(data).hexdigest()
        assert FileManager(tmp_path).compute_hash(f) == expected


class TestCopyForImport:
    def test_copy_created(self, tmp_path):
        src = tmp_path / "invoice.pdf"
        src.write_bytes(b"%PDF-1.4 test")
        copies_dir = tmp_path / "copies"
        fm = FileManager(copies_dir)
        dest = fm.copy_for_import(src)
        assert dest.exists()

    def test_original_unchanged(self, tmp_path):
        src = tmp_path / "invoice.pdf"
        src.write_bytes(b"%PDF-1.4 test")
        original_content = src.read_bytes()
        copies_dir = tmp_path / "copies"
        fm = FileManager(copies_dir)
        fm.copy_for_import(src)
        assert src.read_bytes() == original_content

    def test_copy_has_same_content(self, tmp_path):
        src = tmp_path / "invoice.pdf"
        src.write_bytes(b"%PDF-1.4 content")
        copies_dir = tmp_path / "copies"
        fm = FileManager(copies_dir)
        dest = fm.copy_for_import(src)
        assert dest.read_bytes() == src.read_bytes()

    def test_copy_keeps_extension(self, tmp_path):
        src = tmp_path / "invoice.PDF"
        src.write_bytes(b"%PDF")
        copies_dir = tmp_path / "copies"
        fm = FileManager(copies_dir)
        dest = fm.copy_for_import(src)
        assert dest.suffix == ".pdf"

    def test_copy_in_date_subdirectory(self, tmp_path):
        src = tmp_path / "invoice.pdf"
        src.write_bytes(b"%PDF")
        copies_dir = tmp_path / "copies"
        fm = FileManager(copies_dir)
        dest = fm.copy_for_import(src)
        # path: copies/YYYY/MM/<uuid>.pdf — at least 2 levels deep
        assert len(dest.relative_to(copies_dir).parts) == 3

    def test_two_imports_produce_different_paths(self, tmp_path):
        src = tmp_path / "invoice.pdf"
        src.write_bytes(b"%PDF")
        copies_dir = tmp_path / "copies"
        fm = FileManager(copies_dir)
        dest1 = fm.copy_for_import(src)
        dest2 = fm.copy_for_import(src)
        assert dest1 != dest2

    def test_original_not_deleted(self, tmp_path):
        src = tmp_path / "invoice.pdf"
        src.write_bytes(b"%PDF")
        copies_dir = tmp_path / "copies"
        fm = FileManager(copies_dir)
        fm.copy_for_import(src)
        assert src.exists()

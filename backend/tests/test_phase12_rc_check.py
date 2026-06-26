import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.phase12_rc_check import run_check


class Phase12RCCheckTests(unittest.TestCase):
    def test_rc_check_runs_backup_restore_without_leaking_sqlite_wal_handles(self) -> None:
        report = run_check(file_count=100, keep=False)

        self.assertTrue(report["passed"])
        self.assertEqual(report["incremental_scan"]["created_count"], 1)
        self.assertTrue(report["restore"]["restored"])
        self.assertEqual(report["restored_counts"]["projects"], 1)


if __name__ == "__main__":
    unittest.main()

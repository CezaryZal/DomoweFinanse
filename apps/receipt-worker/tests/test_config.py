import tempfile
import unittest
from pathlib import Path

from receipt_worker.config import Settings


class SettingsTests(unittest.TestCase):
    def test_prefers_project_env_local_over_worker_env(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            project_root = Path(directory)
            worker_root = project_root / "apps" / "receipt-worker"
            worker_root.mkdir(parents=True)
            (project_root / ".env.local").write_text(
                "VITE_SUPABASE_URL=https://project.supabase.co\n"
                "SUPABASE_SECRET_KEY=project-secret\n"
                "RECEIPT_WORKER_POLL_SECONDS=9\n",
                encoding="utf-8",
            )
            (worker_root / ".env").write_text(
                "SUPABASE_URL=https://worker.supabase.co\n"
                "SUPABASE_SECRET_KEY=worker-secret\n"
                "RECEIPT_WORKER_POLL_SECONDS=3\n",
                encoding="utf-8",
            )

            settings = Settings.from_env(project_root, worker_root, environment={})

        self.assertEqual(settings.supabase_url, "https://project.supabase.co")
        self.assertEqual(settings.supabase_secret_key, "project-secret")
        self.assertEqual(settings.poll_seconds, 9)
        self.assertEqual(settings.max_attempts, 3)
        self.assertEqual(settings.lease_seconds, 900)

    def test_process_environment_has_highest_priority(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            settings = Settings.from_env(
                root,
                root / "worker",
                environment={
                    "SUPABASE_URL": "https://environment.supabase.co",
                    "SUPABASE_SECRET_KEY": "environment-secret",
                },
            )

        self.assertEqual(settings.supabase_url, "https://environment.supabase.co")
        self.assertEqual(settings.supabase_secret_key, "environment-secret")

    def test_clamps_attempts_and_lease_to_database_limits(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            settings = Settings.from_env(
                root,
                root / "worker",
                environment={
                    "SUPABASE_URL": "https://environment.supabase.co",
                    "SUPABASE_SECRET_KEY": "environment-secret",
                    "RECEIPT_WORKER_MAX_ATTEMPTS": "99",
                    "RECEIPT_WORKER_LEASE_SECONDS": "30",
                },
            )

        self.assertEqual(settings.max_attempts, 10)
        self.assertEqual(settings.lease_seconds, 60)

    def test_clamps_attempts_and_lease_from_below_and_above(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            low = Settings.from_env(
                root,
                root / "worker",
                environment={
                    "SUPABASE_URL": "https://environment.supabase.co",
                    "SUPABASE_SECRET_KEY": "environment-secret",
                    "RECEIPT_WORKER_MAX_ATTEMPTS": "0",
                    "RECEIPT_WORKER_LEASE_SECONDS": "1",
                },
            )
            high = Settings.from_env(
                root,
                root / "worker",
                environment={
                    "SUPABASE_URL": "https://environment.supabase.co",
                    "SUPABASE_SECRET_KEY": "environment-secret",
                    "RECEIPT_WORKER_MAX_ATTEMPTS": "10",
                    "RECEIPT_WORKER_LEASE_SECONDS": "7200",
                },
            )

        self.assertEqual((low.max_attempts, low.lease_seconds), (1, 60))
        self.assertEqual((high.max_attempts, high.lease_seconds), (10, 3600))

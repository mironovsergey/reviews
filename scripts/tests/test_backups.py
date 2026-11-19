"""Database backup checks with fake Docker, age and S3, without network.

Only command lookup in fixture copies of the scripts is changed. Production
data and credentials are not used. If age is installed, a separate check
uses real encryption/decryption. Invoking sudo is forbidden in these tests.
"""

import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[2]
FIXED_PATH = "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
FAKE_TOOLS = r'''
import base64
import fnmatch
import gzip
import json
import os
from pathlib import Path
import shutil
import sys
import time

root = Path(os.environ["BACKUP_TEST_ROOT"])
tool = Path(sys.argv[0]).name
args = sys.argv[1:]
with (root / "calls.jsonl").open("a") as log:
    log.write(json.dumps([tool, args]) + "\n")

def remote_path(value):
    return root / "remote" / value.split(":", 1)[1]

def option(name):
    return args[args.index(name) + 1] if name in args else None

if tool == "sudo":
    raise AssertionError("database backups must not use sudo")
elif tool == "docker":
    if "mongodump" in " ".join(args):
        if os.environ.get("BACKUP_TEST_FAIL_DB"):
            sys.exit(1)
        data = (b"invalid gzip" if os.environ.get("BACKUP_TEST_BAD_DUMP")
                else gzip.compress(b"test database archive"))
        sys.stdout.buffer.write(data)
    else:
        sys.stdin.buffer.read()
        if os.environ.get("BACKUP_TEST_FAIL_DRY_RUN"):
            sys.exit(1)
        print("reviews.workspaces")
        if not os.environ.get("BACKUP_TEST_MISSING_TARGETS"):
            print("reviews.review_targets")
elif tool == "flock":
    import fcntl
    try:
        fcntl.flock(int(args[-1]), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        sys.exit(1)
elif tool == "age":
    output = Path(option("-o"))
    if os.environ.get("BACKUP_TEST_FAIL_AGE"):
        output.write_bytes(b"unfinished")
        sys.exit(1)
    assert Path(option("-R")).is_file()
    output.write_bytes(b"age-encryption.org/v1\n" +
                       base64.b64encode(Path(args[-1]).read_bytes()))
elif tool == "rclone":
    command = args[0]
    if command == "copyto":
        if os.environ.get("BACKUP_TEST_FAIL_UPLOAD"):
            sys.exit(1)
        source, target = args[-2:]
        assert source.endswith(".age.partial"), source
        target = remote_path(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    else:
        folder = remote_path(args[-1])
        pattern = option("--include") or "*"
        minimum_age = option("--min-age")
        files = sorted(p for p in folder.glob("*") if p.is_file())
        files = [p for p in files if fnmatch.fnmatchcase(p.name, pattern.lstrip("/"))]
        if minimum_age:
            cutoff = time.time() - int(minimum_age[:-1]) * 86400
            files = [p for p in files if p.stat().st_mtime < cutoff]
        if command == "delete":
            if os.environ.get("BACKUP_TEST_FAIL_DELETE"):
                sys.exit(1)
            for file in files:
                file.unlink()
        elif option("--format") == "s":
            for file in files:
                size = file.stat().st_size
                print(size + 1 if os.environ.get("BACKUP_TEST_BAD_SIZE") else size)
        else:
            for file in files:
                print(file.name)
else:
    raise AssertionError(tool)
'''


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="reviews-backup-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.scripts = self.root / "app" / "scripts"
        self.scripts.mkdir(parents=True)
        tools = self.root / "bin"
        tools.mkdir()
        for name in ("sudo", "docker", "flock", "age", "rclone"):
            path = tools / name
            path.write_text("#!" + sys.executable + "\n" + FAKE_TOOLS)
            path.chmod(0o755)
        for name in ("backup-db.sh", "upload-backup.sh"):
            source = (REPO / "scripts" / name).read_text()
            self.assertEqual(source.count(FIXED_PATH), 1)
            source = source.replace(FIXED_PATH, 'export PATH="$BACKUP_TEST_PATH"')
            path = self.scripts / name
            path.write_text(source)
            path.chmod(0o755)
        self.recipients = self.root / "recipients.txt"
        self.recipients.write_text("age1test\n")
        self.backups = self.root / "backups"
        self.state = self.root / "state"
        self.remote = self.root / "remote" / "bucket" / "reviews"
        self.env = {
            **os.environ,
            "BACKUP_TEST_ROOT": str(self.root),
            "BACKUP_TEST_PATH": str(tools) + os.pathsep + os.environ["PATH"],
            "BACKUP_DIR": str(self.backups),
            "BACKUP_STATE_DIR": str(self.state),
            "BACKUP_AGE_RECIPIENTS": str(self.recipients),
            "BACKUP_REMOTE": "test:bucket/reviews",
            "BACKUP_REMOTE_DAYS": "60",
            "BACKUP_KEEP": "2",
        }

    def run_script(self, name="backup-db.sh", *args, **overrides):
        return subprocess.run(
            ["bash", str(self.scripts / name), *map(str, args)],
            env={**self.env, **overrides}, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True,
        )

    def assert_success(self, result):
        self.assertEqual(result.returncode, 0, result.stdout)

    def assert_failed(self, result):
        self.assertNotEqual(result.returncode, 0, result.stdout)

    def calls(self, tool):
        path = self.root / "calls.jsonl"
        if not path.exists():
            return []
        return [args for name, args in map(json.loads, path.read_text().splitlines())
                if name == tool]

    def seed_old(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"previous backup")
        os.utime(path, (1, 1))

    def seed_success(self):
        self.state.mkdir(exist_ok=True)
        marker = self.state / "last-success"
        marker.write_text("previous success")
        return marker

    def test_database_backup_with_remote_updates_success(self):
        self.assert_success(self.run_script())
        self.assertTrue((self.state / "last-success").is_file())
        archive = next(self.backups.glob("reviews-*.archive.gz"))
        self.assertEqual(archive.stat().st_mode & 0o777, 0o600)
        self.assertEqual(gzip.decompress(archive.read_bytes()), b"test database archive")
        self.assertEqual(len(list(self.remote.glob("reviews-*.archive.gz.age"))), 1)
        self.assertEqual(self.calls("sudo"), [])
        self.assertFalse((self.backups / "config").exists())
        self.assertEqual(list(self.backups.glob("*.partial")), [])
        self.assertEqual(list(self.state.glob(".last-success.*")), [])

    def test_local_backup_preserves_external_success_marker(self):
        marker = self.seed_success()
        self.assert_success(self.run_script(BACKUP_REMOTE=""))
        self.assertEqual(len(list(self.backups.glob("reviews-*.archive.gz"))), 1)
        self.assertEqual(marker.read_text(), "previous success")
        self.assertEqual(self.calls("rclone"), [])

    def test_duplicate_backup_does_not_start_dump(self):
        import fcntl
        self.backups.mkdir()
        with (self.backups / ".lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assert_failed(self.run_script())
        self.assertEqual(self.calls("docker"), [])

    def test_local_and_remote_rotation_preserve_other_files(self):
        oldest = self.backups / "reviews-2001-01-01-000000.archive.gz"
        retained = self.backups / "reviews-2001-01-02-000000.archive.gz"
        unrelated = self.backups / "manual.env"
        old_remote = self.remote / (oldest.name + ".age")
        env_remote = self.remote / "reviews-env-2001-01-01-000000.env.age"
        nginx_remote = self.remote / "reviews-nginx-2001-01-01-000000.tar.gz.age"
        config_remote = self.remote / "config" / "reviews-config-2001-01-01-000000.tar.gz.age"
        for path in (oldest, retained, unrelated, old_remote, env_remote, nginx_remote, config_remote):
            self.seed_old(path)
        self.assert_success(self.run_script())
        self.assertFalse(oldest.exists())
        self.assertFalse(old_remote.exists())
        for path in (retained, unrelated, env_remote, nginx_remote, config_remote):
            self.assertTrue(path.exists(), str(path))

    def test_invalid_dump_does_not_rotate_or_upload(self):
        for fault in ("BACKUP_TEST_FAIL_DB", "BACKUP_TEST_BAD_DUMP",
                      "BACKUP_TEST_FAIL_DRY_RUN", "BACKUP_TEST_MISSING_TARGETS"):
            with self.subTest(fault=fault):
                previous = self.backups / "reviews-2001-01-01-000000.archive.gz"
                self.seed_old(previous)
                marker = self.seed_success()
                self.assert_failed(self.run_script(**{fault: "1"}))
                self.assertTrue(previous.exists())
                self.assertEqual(marker.read_text(), "previous success")
                self.assertEqual(self.calls("rclone"), [])
                self.assertEqual(list(self.backups.glob("*.partial")), [])

    def test_upload_failures_preserve_local_copy_and_last_success(self):
        for fault in ("BACKUP_TEST_FAIL_AGE", "BACKUP_TEST_FAIL_UPLOAD", "BACKUP_TEST_BAD_SIZE"):
            with self.subTest(fault=fault):
                old = self.remote / "reviews-2001-01-01-000000.archive.gz.age"
                self.seed_old(old)
                marker = self.seed_success()
                self.assert_failed(self.run_script(**{fault: "1"}))
                self.assertTrue(old.exists())
                self.assertGreaterEqual(len(list(self.backups.glob("reviews-*.archive.gz"))), 1)
                self.assertEqual(marker.read_text(), "previous success")
                self.assertEqual(list(self.backups.glob("*.partial")), [])
                self.assertFalse(any(args[0] == "delete" for args in self.calls("rclone")))

    def test_remote_rotation_failure_preserves_success_marker(self):
        marker = self.seed_success()
        old = self.remote / "reviews-2001-01-01-000000.archive.gz.age"
        self.seed_old(old)
        self.assert_failed(self.run_script(BACKUP_TEST_FAIL_DELETE="1"))
        self.assertTrue(old.exists())
        self.assertEqual(len(list(self.remote.glob("reviews-*.archive.gz.age"))), 2)
        self.assertEqual(marker.read_text(), "previous success")

    def test_uploader_rejects_config_archive(self):
        config = self.root / "reviews-config-2001-01-01-000000.tar.gz"
        config.write_bytes(b"manual configuration archive")
        self.assert_failed(self.run_script("upload-backup.sh", config))
        self.assertEqual(self.calls("age"), [])
        self.assertEqual(self.calls("rclone"), [])

    @unittest.skipUnless(shutil.which("age") and shutil.which("age-keygen"), "age not installed")
    def test_real_encryption_round_trip(self):
        identity = self.root / "test.agekey"
        subprocess.run(
            [shutil.which("age-keygen"), "-o", str(identity)],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        self.recipients.write_bytes(subprocess.run(
            [shutil.which("age-keygen"), "-y", str(identity)],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        ).stdout)
        fake_age = self.root / "bin" / "age"
        fake_age.unlink()
        fake_age.symlink_to(shutil.which("age"))
        self.assert_success(self.run_script())
        encrypted = next(self.remote.glob("reviews-*.archive.gz.age"))
        decrypted = subprocess.run(
            [shutil.which("age"), "-d", "-i", str(identity), str(encrypted)],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        ).stdout
        original = next(self.backups.glob("reviews-*.archive.gz"))
        self.assertEqual(decrypted, original.read_bytes())


if __name__ == "__main__":
    unittest.main()

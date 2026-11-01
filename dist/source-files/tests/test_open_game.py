"""Регрессия реального HTTP-запуска: новый путь импортов, кэш и чужой сервер."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from urllib.parse import urljoin
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('open_game', ROOT / 'tools/open-game.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


@contextmanager
def server(directory, handler=launcher.GameRequestHandler):
    class QuietHandler(handler):
        def log_message(self, *args):
            pass
    http = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(directory)))
    thread = Thread(target=http.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{http.server_port}/'
    finally:
        http.shutdown()
        http.server_close()
        thread.join(timeout=2)


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.build('a' * 64, 'old')

    def build(self, fingerprint, label):
        (self.directory / 'build-info.json').write_text(json.dumps({'sourceFingerprint': fingerprint}), encoding='utf-8')
        (self.directory / 'index.html').write_text('<script type="module" src="./entry.js"></script>', encoding='utf-8')
        (self.directory / 'entry.js').write_text(f'import "./dependency.js"; // {label}', encoding='utf-8')
        (self.directory / 'dependency.js').write_text(label, encoding='utf-8')
        (self.directory / 'worker.js').write_text(label, encoding='utf-8')
        (self.directory / 'style.css').write_text(label, encoding='utf-8')

    def test_root_redirects_and_all_relative_resources_disable_caching(self):
        with server(self.directory) as base:
            entry = launcher.game_url(base, self.directory)
            with urlopen(base) as response:
                self.assertEqual(response.geturl(), entry)
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
            for resource in ['entry.js', 'dependency.js', 'worker.js', 'style.css', 'build-info.json']:
                with urlopen(urljoin(entry, resource)) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertTrue(launcher.existing_game(base, self.directory))

    def test_update_changes_module_urls_without_changing_origin_or_copying_files(self):
        with server(self.directory) as base:
            before = launcher.game_url(base, self.directory)
            with urlopen(urljoin(before, 'dependency.js')) as response:
                self.assertEqual(response.read(), b'old')
            self.build('b' * 64, 'new')
            after = launcher.game_url(base, self.directory)
            self.assertNotEqual(before, after)
            self.assertTrue(after.startswith(base))
            self.assertNotEqual(urljoin(before, 'worker.js'), urljoin(after, 'worker.js'))
            with urlopen(urljoin(after, 'dependency.js')) as response:
                self.assertEqual(response.read(), b'new')
            with urlopen(base) as response:
                self.assertEqual(response.geturl(), after)
            self.assertFalse((self.directory / '_build').exists())

    def test_old_or_foreign_server_is_not_reused_even_with_matching_root_metadata(self):
        with server(self.directory, SimpleHTTPRequestHandler) as base:
            self.assertFalse(launcher.existing_game(base, self.directory))
            # Проверка не останавливает чужой сервер.
            with urlopen(base + 'build-info.json') as response:
                self.assertEqual(response.status, 200)

    def test_invalid_or_missing_build_metadata_is_rejected(self):
        for value in [{}, [], {'sourceFingerprint': '../other'}]:
            (self.directory / 'build-info.json').write_text(json.dumps(value), encoding='utf-8')
            with self.assertRaises(ValueError):
                launcher.game_url('http://127.0.0.1:8000/', self.directory)
        (self.directory / 'build-info.json').unlink()
        self.assertFalse(launcher.existing_game('http://127.0.0.1:8000/', self.directory))


if __name__ == '__main__':
    unittest.main()

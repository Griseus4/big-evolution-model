"""Открывает нынешнюю браузерную игру через локальный HTTP, без установки.

Сервер виден только этому компьютеру. Повторный запуск использует уже
работающий сервер с тем же отпечатком исходников, сохраняя адрес и данные
браузера. Закрытие окна останавливает сервер, созданный этим запуском.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sys
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import urlopen
import webbrowser

HOST, PORT = '127.0.0.1', 8000
BUILD_PREFIX = '/_build/'


def game_url(base: str, directory: Path) -> str:
    """Новый путь сборки обновляет весь граф импортов, включая Worker и CSS.

    Меняется только путь: origin и сохранённые данные браузера остаются прежними.
    Параметр запроса у index.html не обновил бы относительные импорты модулей.
    """
    info = json.loads((directory / 'build-info.json').read_text(encoding='utf-8'))
    fingerprint = info.get('sourceFingerprint', '') if isinstance(info, dict) else ''
    if not isinstance(fingerprint, str) or not re.fullmatch(r'[a-f0-9]{64}', fingerprint):
        raise ValueError('Некорректный отпечаток сборки в dist/build-info.json.')
    return base.rstrip('/') + BUILD_PREFIX + fingerprint + '/index.html'


class GameRequestHandler(SimpleHTTPRequestHandler):
    """Только локальная раздача файлов; состояние симуляции сервер не хранит."""

    def end_headers(self):
        # Иначе браузер вправе повторно использовать старые модули с того же URL.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def translate_path(self, path):
        # Относительные импорты остаются внутри пути сборки; на диске копий нет.
        path = re.sub(r'^/_build/[a-f0-9]{64}/', '/', path, count=1)
        return super().translate_path(path)

    def do_GET(self):
        if urlsplit(self.path).path == '/':
            try:
                target = game_url('', Path(self.directory))
            except (OSError, ValueError):
                self.send_error(503, 'Build metadata unavailable')
                return
            self.send_response(302)
            self.send_header('Location', target)
            self.end_headers()
            return
        super().do_GET()


def existing_game(url: str, directory: Path) -> bool:
    """Не открывать посторонний сайт, случайно занимающий порт 8000."""
    try:
        local = json.loads((directory / 'build-info.json').read_text(encoding='utf-8'))
        build = game_url(url, directory).rsplit('/', 1)[0] + '/build-info.json'
        with urlopen(build, timeout=1) as response:
            remote = json.loads(response.read(1024 * 1024))
            fresh = response.headers.get('Cache-Control') == 'no-store'
        return fresh and isinstance(remote, dict) and bool(local.get('sourceFingerprint')) and (
            remote.get('sourceFingerprint') == local['sourceFingerprint'])
    except (OSError, URLError, ValueError):
        return False


def main() -> int:
    directory = Path(__file__).resolve().parents[1] / 'dist'
    if not (directory / 'index.html').is_file():
        print('Не найден dist/index.html. Сохраните файл запуска вместе с папкой проекта.')
        return 1
    base = f'http://{HOST}:{PORT}/'
    try:
        url = game_url(base, directory)
    except (OSError, ValueError) as error:
        print('Не удалось прочитать текущую сборку: ' + str(error))
        return 1
    if existing_game(base, directory):
        if webbrowser.open(url):
            return 0
        print('Откройте адрес в браузере: ' + url)
        return 1
    try:
        handler = partial(GameRequestHandler, directory=str(directory))
        with ThreadingHTTPServer((HOST, PORT), handler) as server:
            print('Big Evolution: ' + url)
            print('Оставьте это окно открытым, пока играете. Для остановки — Ctrl+C.')
            if not webbrowser.open(url):
                print('Браузер не открылся автоматически. Откройте указанный адрес вручную.')
            server.serve_forever()
    except KeyboardInterrupt:
        print('\nСервер игры остановлен.')
    except OSError as error:
        print('Не удалось запустить сервер: ' + str(error))
        print(f'Если порт {PORT} занят прежним сервером игры, закройте его окно и повторите запуск.')
        print('Если порт занят другой программой, её процесс автоматически не останавливается.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

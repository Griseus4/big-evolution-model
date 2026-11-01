"""Открывает нынешнюю браузерную игру через локальный HTTP, без установки.

Сервер виден только этому компьютеру. Повторный запуск использует уже
работающий сервер с тем же отпечатком исходников, сохраняя адрес и данные
браузера. Закрытие окна останавливает сервер, созданный этим запуском.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser


def existing_game(url: str, directory: Path) -> bool:
    """Не открывать посторонний сайт, случайно занимающий порт 8000."""
    try:
        local = json.loads((directory / 'build-info.json').read_text(encoding='utf-8'))
        with urlopen(url + 'build-info.json', timeout=1) as response:
            remote = json.loads(response.read(1024 * 1024))
        return isinstance(remote, dict) and bool(local.get('sourceFingerprint')) and (
            remote.get('sourceFingerprint') == local['sourceFingerprint'])
    except (OSError, URLError, ValueError):
        return False


def main() -> int:
    directory = Path(__file__).resolve().parents[1] / 'dist'
    if not (directory / 'index.html').is_file():
        print('Не найден dist/index.html. Сохраните файл запуска вместе с папкой проекта.')
        return 1
    url = 'http://127.0.0.1:8000/'
    if existing_game(url, directory):
        if webbrowser.open(url):
            return 0
        print('Откройте адрес в браузере: ' + url)
        return 1
    try:
        handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
        with ThreadingHTTPServer(('127.0.0.1', 8000), handler) as server:
            print('Big Evolution: ' + url)
            print('Оставьте это окно открытым, пока играете. Для остановки — Ctrl+C.')
            if not webbrowser.open(url):
                print('Браузер не открылся автоматически. Откройте указанный адрес вручную.')
            server.serve_forever()
    except KeyboardInterrupt:
        print('\nСервер игры остановлен.')
    except OSError as error:
        print('Не удалось запустить сервер: ' + str(error))
        print('Если порт 8000 занят другой программой, освободите его и повторите запуск.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

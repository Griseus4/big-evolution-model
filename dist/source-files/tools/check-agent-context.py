"""Проверяет компактный вход агента, не запускает игру и не читает архив.

Лимиты — символы, не токены. Семантику/авторизацию определяют пользователь и
контракт; этот guard только замечает разрастание и неполную контрольную запись.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
BUDGETS = {
    'AGENTS.md': 6500,
    'docs/START_HERE.md': 3000,
    'docs/decisions.md': 5000,
    'docs/future-ideas.md': 7000,
    'docs/architecture.md': 7000,
    'docs/mechanics-reference.md': 12000,
    'docs/work/current.md': 3000,
}
FIELDS = ('Статус', 'Цель', 'Режим', 'Разрешено', 'Контракт',
          'Изменённые файлы', 'Проверки', 'Следующий шаг')
STATUSES = {'обсуждение', 'согласован', 'разрешён', 'в работе', 'выполнен', 'заменён'}


def inspect_context(root: Path) -> tuple[list[str], dict[str, int]]:
    errors, sizes, texts = [], {}, {}
    for name, limit in BUDGETS.items():
        path = root / name
        if not path.is_file():
            errors.append(f'Нет входного файла: {name}')
            continue
        text = path.read_text(encoding='utf-8')
        texts[name], sizes[name] = text, len(text)
        if len(text) > limit:
            errors.append(f'{name}: {len(text)} символов > {limit}; вынести подробности по тематической ссылке.')
    checkpoint = texts.get('docs/work/current.md', '')
    for field in FIELDS:
        values = re.findall(r'^' + re.escape(field) + r':[ \t]*([^\n]+)$', checkpoint, re.M)
        if len(values) != 1 or not values[0].strip():
            errors.append(f'Контрольная запись: требуется одно непустое поле «{field}».')
    status = re.search(r'^Статус: (.+)$', checkpoint, re.M)
    if status and status.group(1).strip() not in STATUSES:
        errors.append('Контрольная запись: неизвестный статус.')
    if 'work/current.md' not in texts.get('docs/START_HERE.md', ''):
        errors.append('START_HERE не ссылается на контрольную запись.')
    if 'docs/START_HERE.md' not in texts.get('AGENTS.md', ''):
        errors.append('AGENTS не ссылается на START_HERE.')
    return errors, sizes


def main() -> int:
    errors, sizes = inspect_context(ROOT)
    if errors:
        print('\n'.join(errors))
        return 1
    print('Контекст агента: бюджеты и поля проверены; ' +
          ', '.join(f'{name} {size}/{BUDGETS[name]}' for name, size in sizes.items()) + ' символов.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

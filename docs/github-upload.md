# Upload the source archive to GitHub / Загрузка исходников на GitHub

The archive contains the current0.31.3 source tree, English/Russian READMEs, documentation, tests, and development tools. It does not contain Git history, local reports, browser profiles, or the previous hosting configuration. Uploading this archive does not deploy the website.

## English

1. Extract `Big-Evolution-Model-v0.31.3-GitHub.zip`.
2. Open the extracted `big-evolution-model` folder. Its root contains README.md, README.ru.md, package.json, dist/, docs/, tests/, and tools/.
3. Create an empty GitHub repository named `big-evolution-model`. Select visibility and a license yourself. If importing with Git, leave the automatic README/.gitignore/license initialization unchecked to avoid an unrelated initial commit.
4. Upload the extracted project contents, preserving folders. The ZIP itself is not a replacement for the repository file tree.

For a complete import, Git or GitHub Desktop is more convenient than browser batches. The browser accepts up to100 files per upload. [GitHub upload documentation](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

For a **new empty repository**, from the extracted project folder:

```sh
git init -b main
git add .
git commit -m "Import Big Evolution Model v0.31.3"
git remote add origin https://github.com/YOUR-USERNAME/big-evolution-model.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub account. Authentication is handled by Git/GitHub; do not paste tokens into source files. These commands are instructions for you and have not been executed by the packaging process.

To run the application, follow [README](../README.md). To run the short verification suite without historical commits:

```sh
python tools/verify-local.py --source-only
```

This mode still validates snapshot SHA-256 hashes and runs mechanism/Node checks. Historical Git provenance and working-tree diff are explicitly skipped and listed in the verification report.

The original development repository retains its historical commits. To publish that full history instead of importing this ZIP, use the original repository as the source of a separately authorized push. Do not add a Git bundle as an ordinary project file.

## По-русски

Распакуй архив и загрузи **содержимое** папки `big-evolution-model` в корень репозитория, сохраняя вложенные каталоги. Сам ZIP можно приложить к выпуску как дополнительный файл, но для просмотра кода и README нужны распакованные файлы.

В архиве больше100 файлов, поэтому удобнее использовать GitHub Desktop или Git. При загрузке через браузер понадобятся партии не более100 файлов. Команды выше подходят для нового пустого репозитория; замени имя пользователя на своё. Публикация сайта отдельно не выполняется.

Игра запускается по инструкции [README.ru](../README.ru.md). Исполняемые проверки архива — `python tools/verify-local.py --source-only`. Полная проверка исторических Git-коммитов доступна в исходном рабочем репозитории.

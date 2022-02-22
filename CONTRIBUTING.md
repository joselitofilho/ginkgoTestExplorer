# Contributing

By participating to this project, you agree to abide our [code of
conduct](CODE_OF_CONDUCT.md).

**Table of Contents**

- [Setup your machine](#setup-your-machine)
  - [Using docker](#using-docker)
- [Generate database](#generate-database)
- [Run server](#run-server)
- [Visual Studio Code](#visual-studio-code)
- [Create a commit](#create-a-commit)
- [Submit a pull request](#submit-a-pull-request)
- [Credits](#credits)

## Setup your machine

### Using docker

First time only:
```bash
docker-compose build
```

Run container:
```bash
docker-compose up -d
```

Enter on container:
```bash
docker-compose exec server bash
```

## Visual Studio Code

If you are using VS Code, I strongly recommend you install the following plugin:
- [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) - use a Docker container as a full-featured development environment.
- [ESLint plugin for VS Code](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - which will enable you to view ESLint errors directly in your editor.

To unleash the true powers of ESLint and Prettier, we can configure VS Code so that it auto-corrects ESLint errors.
You should tell VS Code not to formatOnSave, but instead fix ESLint errors on save.
```json
// .vscode/settings.json
{
    "editor.formatOnSave": false,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    }
}
```

## Build

Install dependencies:
```bash
yarn
```

## Deploy

Install dependencies:
```bash
yarn install
```

Packages extension:
```bash
vsce package
```

Publishes extension:
```bash
vsce pulish
```

## Create a commit

Commit messages should be well formatted, and to make that "standardized", we
are using Conventional Commits.

You can follow the documentation on
[their website](https://www.conventionalcommits.org).

## Submit a pull request

- go to a new branch
```bash
git checkout -b feat/my-feature
```
- make your changes
- run tests and linter again 
```bash
yarn lint
```
- Push your branch to [`ginkgoTestExplorer`](https://github.com/joselitofilho/ginkgoTestExplorer) repository
- Open PR against the main branch. 🏄

## Credits

### Contributors

Thank you to all the people who have already contributed to `ginkgoTestExplorer`!

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
$ docker-compose build
```

Run container:
```bash
$ docker-compose up -d
```

Enter on container:
```bash
$ docker-compose exec ginkgo bash
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
$ yarn install
```

Update the version number in the [package.json](package.json) file

Update the [change log](CHANGELOG.md) file

Packages extension:
```bash
$ vsce package
```
(Optional) if you get this problem:
```bash
node_modules/junit2json/dist/index.d.ts:1:8 - error TS1192: Module '"/src/node_modules/junit2json/node_modules/@types/xml2js/index"' has no default export.

1 import xml2js from 'xml2js';
```
Chnage the first line of this file `node_modules/junit2json/dist/index.d.ts` from `import xml2js from 'xml2js';` to `import * as xml2js from 'xml2js';`

Publishes extension:
```bash
$ vsce publish
```

## Create a commit

Commit messages should be well formatted, and to make that "standardized", we
are using Conventional Commits.

You can follow the documentation on
[their website](https://www.conventionalcommits.org).

## Submit a pull request

- go to a new branch
```bash
$ git checkout -b feat/my-feature
```
- make your changes
- run tests and linter again 
```bash
$ yarn lint
```
- Push your branch to [`ginkgoTestExplorer`](https://github.com/joselitofilho/ginkgoTestExplorer) repository
- Open PR against the main branch. 🏄

## Credits

### Contributors

Thank you to all the people who have already contributed to `ginkgoTestExplorer`!

# Ginkgo Test Explorer for VS Code

Welcome!

This VS Code extension offers a set of tools for the [Ginkgo Framework](https://onsi.github.io/ginkgo/).

![Ginkgo Test Explorer](media/ginkgotest.gif)

It is based on two other extensions:
- [GoTestExplorer](https://github.com/ppparihar/GoTestExplorer)
- [vscode-ginkgo-tools](https://github.com/dlipovetsky/vscode-ginkgo-tools)

## Requirements

### Golang

This package requires the Go programming language extension for language support. It also requires you to have golang installed on your machine. To install, follow these [instructions](https://golang.org/doc/install)

### Ginkgo

- Version: 1.15.0 or newer
- The extension does not include the gingko executable. To install, follow these [instructions](https://onsi.github.io/ginkgo/#getting-ginkgo).

Just `go get` it:

```bash
go get github.com/onsi/ginkgo/ginkgo
go get github.com/onsi/gomega/...
```

## Features

### View tests tree

![View tests tree](media/view-tests-tree.png)

### View test file tree

![View test file tree](media/view-test-file-tree.png)

### Run/Debug individual test

![Run/Debug individual test](media/run-debug-individual-tests.png)

### Run/Debug suite tests

![Run/Debug suite tests](media/run-debug-suite-tests.png)

![Run suite tests](media/run-suite-tests.png)

### Generate suite coverage

![Generate suite coverage](media/generate-suite-coverage.png)

### Run all project tests

![Run all project tests](media/run-all-project-tests.png)

### Generate project coverage

![Generate project coverage](media/generate-project-coverage.png)

### Go to symbol in editor

![Go to symbol in editor](media/go-to-symbol.png)

### Command pallete

on Windows or Linux:
- Tap <kbd>ctrl</kbd> + <kbd>shift</kbd> + <kbd>p</kbd>

on MacOS:
- Tap <kbd>command</kbd> + <kbd>shift</kbd> + <kbd>p</kbd>

![Command pallete](media/commands.png)

## License

[MIT](LICENSE "License")
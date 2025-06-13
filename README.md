# Cubyz Dev Kit

Collection of tools helpful for Cubyz asset development.

## Features

- File aware and file context aware completions for IDs.
- Commands:
  - `Cubyz Dev Kit: Build Debug`
  - `Cubyz Dev Kit: Build Release Safe`
  - `Cubyz Dev Kit: Clear Build Cache`
  - `Cubyz Dev Kit: Clear Compiler and Cache`
  - `Cubyz Dev Kit: Format All Documents`

## Development

Development requires:

- Visual Studio Code >=1.90
- Node.js >=20.17.0
- vsce >= 3.4.2 (for packaging)

Start with opening the project in Visual Studio Code. After that, install the dependencies with:

```bash
npm install
```

Then, you can run the extension in development mode by pressing `F5`.

To deploy package, in root of the repository run:

```bash
vsce package
```

This will create a `.vsix` file in the root directory, which has to be manually uploaded to
appropriate marketplaces.

- Microsoft marketplace [direct link](https://marketplace.visualstudio.com/manage/publishers/PixelGuys).
- Open VSX [direct link](https://open-vsx.org/user-settings/namespaces).

May the code be with you!

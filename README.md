# Twain Device Sdk

### Installation

Twain Sdk requires [Node.js](https://nodejs.org/) and [pkg](https://github.com/zeit/pkg#readme) npm package

Install the dependencies and devDependencies and start the server.

```sh
$ npm install -g pkg
```

### Build for Linux x64
```sh
$ pkg --target node10-linux-x64 .
```

### Build for Linux armv7
```sh
$ pkg --target node10.15.3-linux-armv7 --no-bytecode .
```

### Build for Linux arm64
Download the desired arm64 binary from this github [repo](https://github.com/robertsLando/pkg-binaries).
```sh
$ pkg --target node10.15.3-linux-arm64 --no-bytecode .
```

### Create .tar.gz file
```sh
$ tar -czvf twain.tar.gz twain/
```

### Extract .tar.gz file
```sh
$ tar -xvzf twain.tar.gz -C /
```
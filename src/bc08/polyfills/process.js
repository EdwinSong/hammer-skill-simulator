if (typeof globalThis !== 'undefined' && !globalThis.process) {
  globalThis.process = {
    env: {},
    versions: { node: '18.0.0' },
    argv: [],
    cwd: () => '/',
    uptime: () => 0,
    exit: () => {},
    stdin: { fd: 0, isTTY: false },
    stdout: { fd: 1, isTTY: false, write: () => {} },
    stderr: { fd: 2, isTTY: false, write: () => {} },
  };
}

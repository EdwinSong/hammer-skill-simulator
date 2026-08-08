let tmpCounter = 0;

export function dirSync() {
  return { name: '/tmp', removeCallback: () => {} };
}

export function fileSync() {
  tmpCounter += 1;
  return { name: `/tmp/file_${tmpCounter}`, fd: null, removeCallback: () => {} };
}

export function tmpNameSync() {
  tmpCounter += 1;
  return `/tmp/fengari_${tmpCounter}.tmp`;
}

export default {
  dirSync,
  fileSync,
  tmpNameSync,
};

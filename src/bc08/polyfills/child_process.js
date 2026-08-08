export function execSync() {
  throw new Error('execSync is not supported in the simulator');
}

export default {
  execSync,
};

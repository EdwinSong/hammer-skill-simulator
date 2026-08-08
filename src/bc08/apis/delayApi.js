import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua } = fengari;

const delayContinuation = () => 0;

export function createDelayApi(runtime) {
  return {
    register(L) {
      lua.lua_createtable(L, 0, 1);
      lua.lua_pushjsfunction(L, (L2) => {
        const ms = Number(interop.tojs(L2, 1) || 0);
        return runtime.delay(ms, L2, delayContinuation);
      });
      lua.lua_setfield(L, -2, 'delay_ms');
    }
  };
}

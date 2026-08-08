import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua } = fengari;

export function createSysApi(runtime) {
  const api = {
    log: (L) => {
      const level = String(interop.tojs(L, 1) || 'info');
      const message = interop.tojs(L, 2);
      runtime.log(level, message);
      return 0;
    },

    millis: (L) => {
      interop.push(L, Date.now() - runtime.startTime);
      return 1;
    },

    time: (L) => {
      interop.push(L, Math.floor(Date.now() / 1000));
      return 1;
    },

    date: (L) => {
      const format = String(interop.tojs(L, 1) || '*t');
      const ts = interop.tojs(L, 2);
      const d = new Date((ts || Math.floor(Date.now() / 1000)) * 1000);
      if (format === '*t') {
        const t = {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          hour: d.getHours(),
          min: d.getMinutes(),
          sec: d.getSeconds(),
          wday: d.getDay() + 1,
          yday: 0,
        };
        interop.push(L, t);
      } else {
        interop.push(L, d.toISOString());
      }
      return 1;
    },
  };

  return {
    register(L) {
      lua.lua_createtable(L, 0, Object.keys(api).length);
      for (const [name, fn] of Object.entries(api)) {
        lua.lua_pushjsfunction(L, fn);
        lua.lua_setfield(L, -2, name);
      }
    }
  };
}

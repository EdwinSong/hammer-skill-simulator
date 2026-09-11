import * as fengari from 'fengari';
import * as interop from 'fengari-interop';

const { lua, to_luastring } = fengari;

// ── Live miner simulation ────────────────────────────────────────────────
// The real device reads these values from firmware shared memory. In the
// simulator we emulate a running miner: values drift around their nominal
// operating point so dashboards visibly update between refreshes.
const sim = {
  bootTime: Date.now(),
  hashrate: 14.25,        // TH/s, random walk around nominal
  btcPrice: 98520.0,      // USD, random walk
  btcChangePct: 2.35,
  baseBlockHeight: 860432,
};

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function drift(current, step, min, max) {
  const next = current + rnd(-step, step);
  return Math.max(min, Math.min(max, next));
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function simulateSensors() {
  sim.hashrate = drift(sim.hashrate, 0.35, 12.5, 16.0);
  sim.btcPrice = drift(sim.btcPrice, sim.btcPrice * 0.0015, 80000, 120000);
  sim.btcChangePct = drift(sim.btcChangePct, 0.15, -8, 8);

  const chipTemp0 = Math.round(rnd(62, 71));
  const chipTemp1 = chipTemp0 + Math.round(rnd(0, 3));
  const hottest = Math.max(chipTemp0, chipTemp1);
  // Auto fan curve: hotter chips -> faster fans.
  const fanPercent = Math.max(55, Math.min(100, Math.round(55 + (hottest - 60) * 5)));
  const fanRpm0 = Math.round(2400 + fanPercent * 18 + rnd(-80, 80));
  const fanRpm1 = fanRpm0 + Math.round(rnd(-120, 60));

  const efficiency = drift(8.58, 0.12, 7.8, 9.6); // J/TH
  const power = round2(sim.hashrate * efficiency + rnd(-3, 3));
  const voltage = round2(drift(4.8, 0.01, 4.75, 4.85));

  return {
    hashrate: round2(sim.hashrate),
    efficiency: round2(efficiency),
    cpu_temp: round2(drift(48.5, 1.5, 44, 58)),
    psu_temp: Math.round(rnd(50, 55)),
    chip_temp_0: chipTemp0,
    chip_temp_1: chipTemp1,
    fan_rpm_0: fanRpm0,
    fan_rpm_1: fanRpm1,
    fan_percent_0: fanPercent,
    fan_percent_1: fanPercent,
    auto_fan_mode: true,
    manual_fan_percent: 80,
    input_voltage: round2(drift(12.08, 0.05, 11.9, 12.2)),
    voltage,
    out_voltage: voltage,
    out_current: round2(power / Math.max(0.1, voltage)),
    power,
    max_power: 240.0,
    nominal_input_voltage: 12,
    best_diff: '15.8M',
    // A new block is found roughly every 10 minutes.
    latest_block_height: sim.baseBlockHeight + Math.floor((Date.now() - sim.bootTime) / 600000),
    latest_block_pool: 'ZSolo',
    latest_block_reward: 3.125,
    btc_price: round2(sim.btcPrice),
    btc_change_pct: round2(sim.btcChangePct),
    sn: 'BC08-P4-00123456',
  };
}

function simulateStatus() {
  return {
    frequency: 500,
    voltage: 480,
    work_mode: 'Normal',
    pool: 'solo.ckpool.org:3333',
    worker: '1A1zP1eP5QGefi2D...bc08',
    uptime_s: Math.floor((Date.now() - sim.bootTime) / 1000),
  };
}

const DEFAULT_SYSTEM_INFO = {
  hostname: 'bc08-miner',
  wifi_ssid: 'MyHome_WiFi',
  wifi_password: '********',
  timezone: 'UTC+8',
  sn: 'BC08-P4-00123456',
  firmware_version: 'v1.2.0',
  web_version: '1.3.8',
  hardware_version: 'BC08 v1',
  screen_brightness: 100,
  led_on: true,
  led_color: { r: 0, g: 255, b: 128 },
};

const DEFAULT_POOLS = {
  primary: { url: 'solo.ckpool.org', port: 3333, user: '1A1zP1eP5QGefi2D...bc08', pass: 'x' },
  backup: { url: 'pool.vkbit.com', port: 3333, user: '1A1zP1eP5QGefi2D...bc08', pass: 'x' },
};

function pushString(L, s) {
  lua.lua_pushstring(L, to_luastring(String(s)));
}

export function createCapabilityApi(runtime) {
  async function httpRequestAsync(opts) {
    const method = (opts.method || 'GET').toUpperCase();
    const url = String(opts.url || '');
    const timeoutMs = Number(opts.timeout_ms || 10000);
    const maxBody = Number(opts.max_body_bytes || 16384);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: opts.headers || {},
        body: opts.body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      const truncated = text.length > maxBody ? text.slice(0, maxBody) : text;
      return `${res.status} ${res.statusText}\n${truncated}`;
    } catch (err) {
      clearTimeout(timer);
      return `0 Error\n${err.message || 'fetch failed'}`;
    }
  }

  const capabilities = {
    miner_get_sensors: () => ({ ok: true, out: JSON.stringify(simulateSensors()) }),
    miner_get_status: () => ({ ok: true, out: JSON.stringify(simulateStatus()) }),
    miner_get_system_info: () => ({ ok: true, out: JSON.stringify(DEFAULT_SYSTEM_INFO) }),
    miner_get_pools: () => ({ ok: true, out: JSON.stringify(DEFAULT_POOLS) }),

    miner_set_screen_brightness: (payload) => {
      runtime.screenBrightness = Math.max(0, Math.min(100, Number(payload.brightness) || 0));
      return { ok: true, out: '' };
    },
    miner_set_led_color: (payload) => {
      runtime.setRgbState({
        mode: 'solid',
        color: ((Number(payload.r) || 0) << 16) | ((Number(payload.g) || 0) << 8) | (Number(payload.b) || 0),
        effect: null,
      });
      return { ok: true, out: '' };
    },
    miner_set_led_mode: (payload) => {
      if (!payload.on) runtime.setRgbState({ mode: 'solid', color: 0, effect: null });
      return { ok: true, out: '' };
    },
    miner_set_fan_mode: (payload) => ({ ok: true, out: JSON.stringify({ auto: !!payload.auto }) }),
    miner_set_fan_speed: (payload) => ({ ok: true, out: JSON.stringify({ speed: Math.max(0, Math.min(100, Number(payload.speed) || 0)) }) }),
    miner_set_work_mode: (payload) => ({ ok: true, out: JSON.stringify({ mode: payload.mode || 'Normal' }) }),
    miner_set_frequency: (payload) => ({ ok: true, out: JSON.stringify({ mhz: Number(payload.mhz) || 500 }) }),
    miner_set_voltage: (payload) => ({ ok: true, out: JSON.stringify({ mv: Number(payload.mv) || (Number(payload.v) || 480) * 10 }) }),
    miner_set_pool: (payload) => ({ ok: true, out: JSON.stringify({ type: payload.type || 'primary' }) }),
    miner_set_system_config: (payload) => ({ ok: true, out: JSON.stringify(payload) }),
    miner_restart: () => ({ ok: true, out: '' }),

    http_request: (payload) => ({ ok: true, async: true, promise: httpRequestAsync(payload) }),

    qq_send_message: () => ({ ok: true, out: '' }),
    tg_send_message: () => ({ ok: true, out: '' }),
    wechat_send_message: () => ({ ok: true, out: '' }),
  };

  function callCapability(name, payload) {
    const fn = capabilities[name];
    if (!fn) {
      return { ok: false, out: '', err: `unknown capability: ${name}` };
    }
    try {
      return fn(payload);
    } catch (err) {
      return { ok: false, out: '', err: err.message || String(err) };
    }
  }

  return {
    register(L) {
      lua.lua_createtable(L, 0, 2);

      lua.lua_pushjsfunction(L, (LL) => {
        const name = String(interop.tojs(LL, 1) || '');
        const payload = interop.tojs(LL, 2) || {};
        const result = callCapability(name, payload);

        if (result.async && result.promise) {
          const opts = interop.tojs(LL, 3) || {};
          const ref = opts.callback_ref;
          result.promise.then((out) => {
            runtime.invokeCapabilityCallback(ref, true, out, '');
          }).catch((err) => {
            runtime.invokeCapabilityCallback(ref, false, '', err.message || String(err));
          });
          lua.lua_pushboolean(LL, true);
          lua.lua_pushliteral(LL, '');
          lua.lua_pushliteral(LL, '');
          return 3;
        }

        lua.lua_pushboolean(LL, result.ok);
        pushString(LL, result.out);
        pushString(LL, result.err || '');
        return 3;
      });
      lua.lua_setfield(L, -2, 'call');
    },
  };
}

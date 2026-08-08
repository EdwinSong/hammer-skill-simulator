import { useState, useCallback, useRef, useEffect } from 'react';
import { LuaRuntime } from './core/LuaRuntime.js';
import { LuaEditor } from './components/LuaEditor.jsx';
import { ScreenCanvas } from './components/ScreenCanvas.jsx';
import { ControlPanel } from './components/ControlPanel.jsx';
import { DebugLog } from './components/DebugLog.jsx';
import { DeviceVisualizer } from './renderers/DeviceVisualizer.jsx';
import { SkillLibrary } from './components/SkillLibrary.jsx';
import { SimulatorLoading } from './components/SimulatorLoading.jsx';
import { FLAPPY_BIRD, CLOCK_DIAL_DEMO } from './examples/index.js';
import { useI18n } from './i18n/I18nContext';
import { registerImportedImages } from './renderers/CanvasRenderer.js';
import { parseSkillFromFiles, saveImportedSkill, openLocalSkillDirectory } from './utils/skillImport.js';

const PRELOAD_ASSETS = [
  '/raw/bc08-1.png',
  '/raw/bc08-simulator-icons/nav-home.png',
  '/raw/bc08-simulator-icons/nav-globe.png',
  '/raw/bc08-simulator-icons/nav-database.png',
  '/raw/bc08-simulator-icons/nav-skills.png',
];

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

const DEFAULT_SCRIPT = `local PAGE = 1
local W, H = claw.display.get_size()

local function redrawBase()
    claw.display.clear_page(PAGE)
    claw.display.container(PAGE, 1, 0, 0, W, H, 0x000000, 0)
    claw.display.label(PAGE, 2, 40, 40, "Net API Test", 0x02FFB5, 36)
end

local function showStatus(text, color)
    redrawBase()
    claw.display.label(PAGE, 3, 40, 90, text, color or 0xAAAAAA, 20)
end

claw.display.create_page(PAGE, "Net API Test")
redrawBase()
showStatus("Running tests...", 0xFFFF00)

local errors = {}
local testResults = {}

showStatus("Testing: net.get_network_stats()...", 0xAAAAAA)
sys.log("info", "Testing: net.get_network_stats()")
local stats = net.get_network_stats()
if type(stats) ~= "table" then
    table.insert(errors, "get_network_stats() did not return a table")
else
    if stats.hashrate_ths ~= 12 then
        table.insert(errors, "hashrate_ths expected 12, got " .. tostring(stats.hashrate_ths))
    end
    if stats.unit ~= "TH/s" then
        table.insert(errors, "unit expected 'TH/s', got " .. tostring(stats.unit))
    end
    if stats.source ~= "default" then
        table.insert(errors, "source expected 'default', got " .. tostring(stats.source))
    end
end
testResults.stats = stats
showStatus("OK: net.get_network_stats() = " .. tostring(stats.hashrate_ths) .. " " .. tostring(stats.unit), 0x00FF00)

local pendingPrices = 4
local function checkPricesDone()
    pendingPrices = pendingPrices - 1
    if pendingPrices > 0 then return end

    redrawBase()
    local y = 90
    if #errors == 0 then
        claw.display.label(PAGE, 3, 40, y, "All tests passed!", 0x00FF00, 28)
        sys.log("info", "Net API test: all passed")
    else
        claw.display.label(PAGE, 3, 40, y, "Failed:", 0xFF0000, 28)
        y = y + 40
        for i, err in ipairs(errors) do
            claw.display.label(PAGE, 10 + i, 40, y, err, 0xFF5555, 18)
            y = y + 28
            sys.log("error", "Net API test: " .. err)
        end
    end

    y = y + 50
    claw.display.label(PAGE, 20, 40, y, "Hashrate: " .. tostring(stats.hashrate_ths) .. " " .. tostring(stats.unit), 0xAAAAAA, 20)
    if testResults.btc then
        y = y + 30
        claw.display.label(PAGE, 21, 40, y, "BTC: $" .. tostring(testResults.btc.usd) .. " (" .. tostring(testResults.btc.source) .. ")", 0xAAAAAA, 20)
    end
end

showStatus("Testing: BTC price...", 0xAAAAAA)
sys.log("info", "Testing: BTC price")
net.get_coin_price("BTC", function(price)
    if type(price) ~= "table" or type(price.usd) ~= "number" then
        table.insert(errors, "BTC price callback invalid")
    else
        testResults.btc = price
        showStatus("OK: BTC = $" .. tostring(price.usd) .. " (" .. tostring(price.source) .. ")", 0x00FF00)
    end
    checkPricesDone()
end)

showStatus("Testing: LTC price...", 0xAAAAAA)
sys.log("info", "Testing: LTC price")
net.get_coin_price("LTC", function(price)
    if type(price) ~= "table" or type(price.usd) ~= "number" then
        table.insert(errors, "LTC price callback invalid")
    end
    checkPricesDone()
end)

showStatus("Testing: DOGE price...", 0xAAAAAA)
sys.log("info", "Testing: DOGE price")
net.get_coin_price("DOGE", function(price)
    if type(price) ~= "table" or type(price.usd) ~= "number" then
        table.insert(errors, "DOGE price callback invalid")
    end
    checkPricesDone()
end)

showStatus("Testing: XYZ price...", 0xAAAAAA)
sys.log("info", "Testing: XYZ price")
net.get_coin_price("XYZ", function(price)
    if type(price) ~= "table" or price.usd ~= 0 then
        table.insert(errors, "Unknown coin expected 0, got " .. tostring(price and price.usd))
    end
    checkPricesDone()
end)

while true do
    local p, obj = claw.display.pop_event()
    if p then
        sys.log("info", "event page=" .. p .. " obj=" .. obj)
    end
    delay.delay_ms(33)
end
`;

const EXAMPLES = [
  { id: 'net-api-test', title: 'Net API Test', description: 'Default net.get_network_stats / get_coin_price test', code: DEFAULT_SCRIPT },
  { id: 'flappybird', title: 'Flappy Bird', description: 'Touch to jump', code: FLAPPY_BIRD },
  { id: 'clock', title: 'Clock Dial', description: 'Digital clock demo', code: CLOCK_DIAL_DEMO },
];

export function Bc08Simulator() {
  const { t } = useI18n();
  const [resourcesReady, setResourcesReady] = useState(false);
  const [code, setCode] = useState(DEFAULT_SCRIPT);
  const [logs, setLogs] = useState([]);
  const [screenState, setScreenState] = useState({ pages: [] });
  const [rgbState, setRgbState] = useState({
    mode: 'solid',
    color: 0,
    zones: [0, 0, 0, 0],
    effect: null,
    effectParams: {},
  });
  const [status, setStatus] = useState('stopped');
  const [skillLibraryOpen, setSkillLibraryOpen] = useState(false);
  const runtimeRef = useRef(null);
  const fileInputRef = useRef(null);
  const [screenCanvas, setScreenCanvas] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(PRELOAD_ASSETS.map(preloadImage)).then(() => {
      if (!cancelled) setResourcesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addLog = useCallback((entry) => {
    setLogs((prev) => [...prev.slice(-499), entry]);
  }, []);

  useEffect(() => {
    return () => {
      runtimeRef.current?.stop();
    };
  }, []);

  const ensureRuntime = useCallback(() => {
    if (!runtimeRef.current) {
      runtimeRef.current = new LuaRuntime({
        onLog: addLog,
        onScreenUpdate: setScreenState,
        onRgbUpdate: setRgbState,
        onStateChange: setStatus,
      });
    }
    return runtimeRef.current;
  }, [addLog]);

  const runScript = useCallback(() => {
    ensureRuntime().run(code);
  }, [code, ensureRuntime]);

  const stopScript = useCallback(() => {
    runtimeRef.current?.stop();
  }, []);

  const resetScript = useCallback(() => {
    runtimeRef.current?.stop();
    setScreenState({ pages: [] });
    setRgbState({
      mode: 'solid',
      color: 0,
      zones: [0, 0, 0, 0],
      effect: null,
      effectParams: {},
    });
    setLogs([]);
  }, []);

  const handleScreenClick = useCallback((pageId, objId) => {
    const targetPage = pageId ?? screenState.pages[screenState.pages.length - 1]?.id;
    if (targetPage != null) {
      ensureRuntime().pushEvent(targetPage, objId ?? 0);
    }
  }, [ensureRuntime, screenState]);

  const loadSkillCode = useCallback(({ code, imageMap }) => {
    runtimeRef.current?.stop();
    registerImportedImages(imageMap || {});
    setLogs([]);
    setCode(code);
  }, []);

  const handleImportDirectory = useCallback(async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      await importFiles(files);
    } finally {
      e.target.value = '';
    }
  }, []);

  const importFiles = useCallback(async (files) => {
    try {
      const imported = await parseSkillFromFiles(files);
      if (imported.length === 0) {
        addLog({ level: 'warn', message: 'No Lua script found in selected directory', time: Date.now() });
        return;
      }
      imported.forEach((skill) => {
        saveImportedSkill(skill);
        skill.warnings?.forEach((w) => {
          addLog({ level: 'warn', message: `[${skill.title}] ${w}`, time: Date.now() });
        });
      });
      addLog({ level: 'info', message: `Imported ${imported.length} skill(s) from local directory`, time: Date.now() });
      setSkillLibraryOpen(true);
    } catch (err) {
      addLog({ level: 'error', message: `Import failed: ${err.message}`, time: Date.now() });
    }
  }, [addLog]);

  const handleImportClick = useCallback(async () => {
    try {
      if (window.showDirectoryPicker) {
        const files = await openLocalSkillDirectory();
        if (files) {
          await importFiles(files);
          return;
        }
      }
      fileInputRef.current?.click();
    } catch (err) {
      addLog({ level: 'error', message: `Import failed: ${err.message}`, time: Date.now() });
    }
  }, [importFiles, addLog]);

  const handleScreenCanvasReady = useCallback((canvas) => {
    setScreenCanvas(canvas);
  }, []);

  if (!resourcesReady) {
    return <SimulatorLoading />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] min-h-[600px] bg-gray-950 text-gray-100">
      <header className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h1 className="font-semibold">BC08 Lua Simulator</h1>
        <span className="text-xs text-gray-500">API v0.1</span>
      </header>

      <div className="flex-1 grid grid-cols-2 grid-rows-[1fr_minmax(260px,40%)] gap-4 p-4 min-h-0">
        {/* Top-left: BC08 device image */}
        <div className="min-h-0">
          <DeviceVisualizer screenCanvas={screenCanvas} rgbState={rgbState} />
        </div>

        {/* Top-right: Skill Card screen simulation */}
        <div className="relative flex flex-col bg-gray-900 border border-gray-800 rounded overflow-hidden">
          <div className="absolute top-3 left-3 z-10 text-sm font-bold text-cyan-400 bg-gray-950/80 px-2 py-1 rounded border border-gray-700">
            {t('panel-skill-card')}
          </div>
          <div className="flex-1 flex flex-col min-h-0 items-center justify-center p-2">
            {/* Simulated screen frame */}
            <div className="relative max-h-full max-w-full border border-gray-700 rounded overflow-hidden bg-black">
              <ScreenCanvas state={screenState} onClick={handleScreenClick} onCanvasReady={handleScreenCanvasReady} />
            </div>
          </div>
        </div>

        {/* Bottom-left: Lua code editor + example/skill buttons */}
        <div className="min-h-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleImportDirectory}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              className="bg-gray-900 text-gray-300 text-sm border border-gray-700 rounded px-3 py-1.5 hover:bg-gray-800 focus:outline-none"
            >
              Import local Skill
            </button>
            <button
              onClick={() => setSkillLibraryOpen(true)}
              className="bg-gray-900 text-cyan-400 text-sm border border-cyan-600 rounded px-3 py-1.5 hover:bg-cyan-950 focus:outline-none"
            >
              Skills
            </button>
            <span className="text-[10px] text-gray-500">
              Imported skills are read locally and stored in your browser (localStorage). No files are uploaded to the server.
            </span>
          </div>
          <LuaEditor value={code} onChange={setCode} />
        </div>

        {/* Bottom-right: Controls + debug log */}
        <div className="min-h-0 flex flex-col gap-2">
          <ControlPanel
            status={status}
            onRun={runScript}
            onStop={stopScript}
            onReset={resetScript}
          />
          <DebugLog logs={logs} />
        </div>
      </div>

      <SkillLibrary
        isOpen={skillLibraryOpen}
        onClose={() => setSkillLibraryOpen(false)}
        onLoad={loadSkillCode}
      />
    </div>
  );
}

export function ControlPanel({ status, onRun, onStop, onReset }) {
  const running = status === 'running';
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onRun}
        disabled={running}
        className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
      >
        Run
      </button>
      <button
        onClick={onStop}
        disabled={!running}
        className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
      >
        Stop
      </button>
      <button
        onClick={onReset}
        className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium"
      >
        Reset
      </button>
      <span className="ml-auto text-xs text-gray-400 uppercase">{status}</span>
    </div>
  );
}

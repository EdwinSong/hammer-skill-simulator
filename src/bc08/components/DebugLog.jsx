import { useEffect, useRef } from 'react';

const levelClasses = {
  error: 'text-red-400',
  warn: 'text-yellow-400',
  info: 'text-gray-300',
  debug: 'text-gray-500',
};

export function DebugLog({ logs }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  return (
    <div
      ref={ref}
      className="flex-1 min-h-[120px] overflow-auto bg-gray-900 border border-gray-700 rounded p-2 font-mono text-xs"
    >
      {logs.length === 0 && (
        <div className="text-gray-600 italic">No messages yet.</div>
      )}
      {logs.map((log, i) => (
        <div key={i} className={levelClasses[log.level] || 'text-gray-300'}>
          [{new Date(log.time).toLocaleTimeString()}] {log.message}
        </div>
      ))}
    </div>
  );
}

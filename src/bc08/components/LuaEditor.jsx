export function LuaEditor({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full min-h-[160px] bg-gray-900 text-gray-100 font-mono text-sm p-3 resize-none border border-gray-700 rounded focus:outline-none focus:border-cyan-500"
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
    />
  );
}

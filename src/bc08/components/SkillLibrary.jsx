import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { validateSkillCode, hasBlockingError } from '../utils/skillValidator.js';
import { getImportedSkills, saveImportedSkills, deleteImportedSkill } from '../utils/skillImport.js';

export function SkillLibrary({ isOpen, onClose, onLoad }) {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState([]);
  const [imported, setImported] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/skills/skills-catalog.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCatalog(data.skills || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    setImported(getImportedSkills());
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen]);

  const handleLoad = async (skill) => {
    try {
      let code;
      if (skill.code) {
        code = skill.code;
      } else if (skill.main_script) {
        const res = await fetch(skill.main_script);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        code = await res.text();
      }
      if (code === undefined) throw new Error('No script available');

      const validation = validateSkillCode(code);
      if (!validation.ok) {
        throw new Error(validation.errors.join('; '));
      }

      onLoad({ code, imageMap: skill.imageMap || {} });
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteImported = (e, id) => {
    e.stopPropagation();
    deleteImportedSkill(id);
    setImported(getImportedSkills());
  };

  const handleClearImported = () => {
    saveImportedSkills([]);
    setImported([]);
  };

  const SkillCard = ({ skill, onDelete }) => (
    <div
      key={skill.id}
      className="flex flex-col bg-gray-950 border border-gray-800 rounded overflow-hidden hover:border-cyan-500/50 transition-colors"
    >
      <div className="h-28 bg-gray-900 flex items-center justify-center overflow-hidden">
        {skill.preview_url ? (
          <img
            src={skill.preview_url}
            alt={skill.title}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-gray-600 text-xs">No preview</div>
        )}
      </div>
      <div className="flex-1 p-3 flex flex-col gap-1">
        <div className="font-medium text-gray-100 text-sm">{skill.title}</div>
        <div className="text-xs text-gray-400 line-clamp-2">{skill.description}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {skill.categories?.map((cat) => (
            <span
              key={cat}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400"
            >
              {cat}
            </span>
          ))}
        </div>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-500">{skill.author || 'Unknown'}</span>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                onClick={(e) => onDelete(e, skill.id)}
                className="text-xs px-2 py-1 rounded border border-red-700 text-red-400 hover:bg-red-950"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => handleLoad(skill)}
              disabled={!skill.code && !skill.main_script}
              className="text-xs px-2 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500"
            >
              Load
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const Section = ({ title, children, count, action }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">
          {title} {count > 0 && <span className="text-gray-500 font-normal">({count})</span>}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-5xl max-h-[85vh] flex flex-col bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-100">Skill Library</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-100 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading && <div className="text-gray-400 text-sm">Loading skills...</div>}
          {error && <div className="text-red-400 text-sm">Error: {error}</div>}

          {catalog.length > 0 && (
            <Section title="SKILLS In Store" count={catalog.length}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalog.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>
            </Section>
          )}

          {imported.length > 0 && (
            <Section
              title="Local Imported"
              count={imported.length}
              action={
                <button
                  onClick={handleClearImported}
                  className="text-xs px-2 py-1 rounded border border-red-700 text-red-400 hover:bg-red-950"
                >
                  Clear all
                </button>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imported.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onDelete={handleDeleteImported} />
                ))}
              </div>
            </Section>
          )}

          {imported.length === 0 && !loading && (
            <div className="text-gray-500 text-sm">
              No local skills yet. Click “Import local Skill” to load one from your computer.
            </div>
          )}

          {!loading && catalog.length === 0 && imported.length === 0 && (
            <div className="text-gray-500 text-sm">No skills found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

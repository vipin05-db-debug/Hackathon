import React, { useState } from 'react';
import { 
  ShieldAlert, AlertTriangle, Clock, AlertCircle, 
  CheckCircle2, ListCheck, BookOpen, Lightbulb, 
  FileText, ExternalLink 
} from 'lucide-react';

function parseReportText(text) {
  if (!text) return null;

  const sections = {
    conclusion: '',
    keyFindings: [],
    verifiedInfo: [],
    informationGaps: [],
    conflictingInfo: [],
    outdatedInfo: [],
    unansweredQuestions: [],
    recommendations: [],
    checklist: [],
    limitations: []
  };

  const headers = [
    { key: 'conclusion', title: '1. CONCLUSION' },
    { key: 'keyFindings', title: '2. KEY FINDINGS' },
    { key: 'verifiedInfo', title: '3. VERIFIED INFORMATION' },
    { key: 'informationGaps', title: '4. INFORMATION GAPS' },
    { key: 'conflictingInfo', title: '5. CONFLICTING INFORMATION' },
    { key: 'outdatedInfo', title: '6. OUTDATED INFORMATION' },
    { key: 'unansweredQuestions', title: '7. UNANSWERED QUESTIONS' },
    { key: 'recommendations', title: '8. RECOMMENDATIONS' },
    { key: 'checklist', title: '9. VERIFICATION CHECKLIST' },
    { key: 'limitations', title: '10. LIMITATIONS' }
  ];

  let currentKey = null;
  const lines = text.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const matchedHeader = headers.find(h => 
      trimmed.toUpperCase().includes(h.title) || 
      trimmed.toUpperCase().startsWith(h.title.replace(/\d+\.\s*/, ''))
    );

    if (matchedHeader) {
      currentKey = matchedHeader.key;
      return;
    }

    if (!currentKey) {
      sections.conclusion += line + ' ';
      return;
    }

    if (Array.isArray(sections[currentKey])) {
      const cleanLine = trimmed.replace(/^[\-\*\•\d+\.]+\s*/, '');
      if (cleanLine) {
        sections[currentKey].push(cleanLine);
      }
    } else {
      sections[currentKey] += line + ' ';
    }
  });

  return sections;
}

export default function ReportViewer({ content, sources = [] }) {
  const [completedTasks, setCompletedTasks] = useState({});
  const parsed = parseReportText(content);

  if (!parsed) return <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>;

  const toggleTask = (index) => {
    setCompletedTasks(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-6 text-slate-200 font-sans w-full max-w-full overflow-hidden">
      
      {/* 1. Conclusion */}
      {parsed.conclusion && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center space-x-2 text-indigo-400 mb-2">
            <FileText className="w-5 h-5" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Executive Conclusion</h3>
          </div>
          <p className="text-sm leading-relaxed">{parsed.conclusion.trim()}</p>
        </div>
      )}

      {/* 2. Key Findings */}
      {parsed.keyFindings.length > 0 && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center space-x-2 text-cyan-400 mb-3 border-b border-slate-700/50 pb-2">
            <Lightbulb className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Key Findings</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-300">
            {parsed.keyFindings.map((finding, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Gaps & Conflicts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parsed.informationGaps.length > 0 && (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center space-x-2 text-rose-400 mb-3 border-b border-slate-700/50 pb-2">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Information Gaps</h3>
            </div>
            <div className="space-y-2">
              {parsed.informationGaps.map((gap, i) => (
                <div key={i} className="bg-rose-900/20 border border-rose-800/30 rounded-xl p-3 text-sm text-rose-200">
                  {gap}
                </div>
              ))}
            </div>
          </div>
        )}

        {parsed.conflictingInfo.length > 0 && (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center space-x-2 text-amber-400 mb-3 border-b border-slate-700/50 pb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Source Conflicts</h3>
            </div>
            <div className="space-y-2">
              {parsed.conflictingInfo.map((conf, i) => (
                <div key={i} className="bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-sm text-amber-200">
                  {conf}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Verification Checklist */}
      {parsed.checklist.length > 0 && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-3 mb-3">
            <div className="flex items-center space-x-2 text-emerald-400">
              <ListCheck className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Verification Checklist</h3>
            </div>
          </div>
          <div className="space-y-2">
            {parsed.checklist.map((item, idx) => {
              const done = completedTasks[idx];
              return (
                <div 
                  key={idx}
                  onClick={() => toggleTask(idx)}
                  className={`flex items-center space-x-3 p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                    done 
                      ? 'bg-slate-800/40 border-slate-700/50 opacity-50 line-through text-slate-400' 
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${done ? 'bg-emerald-600 border-emerald-500' : 'border-slate-600'}`}>
                    {done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span>{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Sources */}
      {sources && sources.length > 0 && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center space-x-2 text-indigo-400 mb-3 border-b border-slate-700/50 pb-2">
            <BookOpen className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Evidence Sources</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {sources.map((source, i) => (
              <a key={i} href={source.url} target="_blank" rel="noreferrer" className="bg-slate-800/80 border border-slate-700 hover:border-indigo-500/50 p-3 rounded-xl flex items-center justify-between group">
                <div className="truncate pr-2">
                  <span className="font-semibold text-indigo-400 mr-2">[S{i + 1}]</span>
                  <span className="text-slate-300 truncate group-hover:text-indigo-300">{source.title || source.url}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
import React from 'react';
import { useToast } from '../context/ToastContext';

const TOAST_STYLES = {
  success: {
    container: 'bg-green-900/90 border-green-500/60 text-green-200',
    icon: '✓',
    iconCls: 'text-green-400',
  },
  error: {
    container: 'bg-red-900/90 border-red-500/60 text-red-200',
    icon: '✕',
    iconCls: 'text-red-400',
  },
  info: {
    container: 'bg-blue-900/90 border-blue-500/60 text-blue-200',
    icon: 'ℹ',
    iconCls: 'text-blue-400',
  },
  warning: {
    container: 'bg-amber-900/90 border-amber-500/60 text-amber-200',
    icon: '⚠',
    iconCls: 'text-amber-400',
  },
};

function ToastItem({ toast }) {
  const { removeToast } = useToast();
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

  return (
    <div className={`
      flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-sm
      min-w-72 max-w-sm animate-fade-in
      ${style.container}
    `}>
      <span className={`text-lg font-bold mt-0.5 shrink-0 ${style.iconCls}`}>
        {style.icon}
      </span>
      <p className="text-sm flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-slate-400 hover:text-white transition-colors shrink-0 text-xs mt-0.5"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}

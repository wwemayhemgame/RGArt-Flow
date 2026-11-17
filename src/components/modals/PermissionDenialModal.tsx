import React from 'react';
import { ShieldAlert, X, Lock, CheckCircle2 } from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { getRoleProfile } from '../../utils/rolePermissions';

interface PermissionDenialModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionName: string;
  roleName: string;
  reason: string;
}

export const PermissionDenialModal: React.FC<PermissionDenialModalProps> = ({
  isOpen,
  onClose,
  actionName,
  roleName,
  reason
}) => {
  const { previewRole, exitRolePreview } = useArtOps();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950">Action Restricted</h3>
              <p className="text-xs text-rose-700 font-medium">Role Permission Policy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-rose-400 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-100/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">Attempted Action:</span>
              <span className="font-bold text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                {actionName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">Active Role:</span>
              <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                {roleName}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-600 leading-relaxed bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/60 flex items-start gap-2.5">
            <Lock size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-0.5">Permission Policy</p>
              <p className="text-amber-800">{reason}</p>
            </div>
          </div>

          {previewRole && (
            <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
              <span>You are currently in <strong>Role Preview Mode</strong>.</span>
              <button
                onClick={() => {
                  exitRolePreview();
                  onClose();
                }}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline ml-2 cursor-pointer"
              >
                Exit Preview
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};

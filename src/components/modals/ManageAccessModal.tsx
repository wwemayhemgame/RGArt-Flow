import React, { useState } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { ProjectAccessLevel } from '../../types';
import { Modal } from '../common/Modal';
import { AccessLevelBadge } from '../common/Badge';

interface ManageAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  defaultProjectId?: string;
}

export const ManageAccessModal: React.FC<ManageAccessModalProps> = ({
  isOpen,
  onClose,
  projectId: propProjectId,
  defaultProjectId
}) => {
  const { users, projects, updateProjectAccess } = useArtOps();

  const [activeProjectId, setActiveProjectId] = useState(propProjectId || defaultProjectId || projects[0]?.id || '');
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
  const [accessLevel, setAccessLevel] = useState<ProjectAccessLevel>('EDITOR');
  const [notes, setNotes] = useState('');

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // List existing members of current project
  const projectMembers = currentProject?.members || [];

  const handleGrantAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !activeProjectId) return;

    updateProjectAccess(selectedUserId, activeProjectId, accessLevel, notes.trim() || undefined);
    setNotes('');
  };

  const handleRemoveMember = (userId: string) => {
    updateProjectAccess(userId, activeProjectId, 'Removed', 'Access revoked by manager');
  };

  return (
    <Modal
      id="modal-manage-access"
      isOpen={isOpen}
      onClose={onClose}
      title="Project Access & RBAC Permissions"
      subtitle={`Manage team access levels and permission audit logs for ${currentProject?.name}`}
      maxWidth="3xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg"
        >
          Done
        </button>
      }
    >
      <div className="space-y-6">
        {/* Project Selector */}
        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Select Project</label>
          <select
            value={activeProjectId}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="w-full text-xs font-semibold bg-zinc-50 border border-zinc-300 rounded-md px-3 py-2 focus:border-zinc-900 outline-hidden"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
            ))}
          </select>
        </div>

        {/* Grant or Update Access Form */}
        <form onSubmit={handleGrantAccess} className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Grant or Update Access Level
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1">User *</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1">Access Level *</label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as ProjectAccessLevel)}
                className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden font-medium"
              >
                <option value="VIEWER">VIEWER (Read-only)</option>
                <option value="COMMENTER">COMMENTER (Comments & Reviews)</option>
                <option value="EDITOR">EDITOR (Create & Edit Tasks)</option>
                <option value="MANAGER">MANAGER (Sprint & Project Admin)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1">Audit Reason / Note</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Lead 3D Artist on project"
                className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              id="btn-confirm-grant-access"
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-md shadow-xs cursor-pointer"
            >
              Save Permission
            </button>
          </div>
        </form>

        {/* Current Active Permissions List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Current Project Members ({projectMembers.length})
            </h4>
          </div>

          <div className="border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-100">
            {projectMembers.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                No explicit access rules configured yet. Global role defaults apply.
              </div>
            ) : (
              projectMembers.map(member => {
                const user = users.find(u => u.id === member.userId);
                return (
                  <div key={member.userId} className="p-3 bg-white flex items-center justify-between text-xs hover:bg-zinc-50">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-zinc-900">{user?.name || member.userId}</p>
                        <p className="text-[11px] text-zinc-400">{user?.email} • {user?.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <AccessLevelBadge level={member.accessLevel} />
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        Revoke Access
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

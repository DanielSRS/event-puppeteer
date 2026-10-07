import React from 'react';
import { MdPerson, MdShield, MdWarning, MdVerifiedUser, MdMoreVert, MdDelete } from 'react-icons/md';

export type UserRole = 'Member' | 'Moderator' | 'Admin';

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  joinedAt?: string;
}

interface UserListProps {
  users: OrgUser[];
  onChangeRole: (userId: string, newRole: UserRole) => void;
  onRemoveUser: (userId: string) => void;
}

const RoleIcon = ({ role }: { role: UserRole }) => {
  switch (role) {
    case 'Admin': return <MdWarning className="w-4 h-4 text-danger" />;
    case 'Moderator': return <MdVerifiedUser className="w-4 h-4 text-main" />;
    default: return <MdPerson className="w-4 h-4 text-foreground/60" />;
  }
};

export function UserList({ users, onChangeRole, onRemoveUser }: UserListProps) {
  return (
    <div className="overflow-hidden bg-surface shadow-sm ring-1 ring-muted sm:rounded-lg">
      <table className="min-w-full divide-y divide-muted">
        <thead className="bg-background">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
              Nome
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
              Email
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
              Cargo
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
              Data de Entrada
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted bg-surface">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                {user.name}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/60">
                {user.email}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/60">
                <div className="flex items-center gap-2">
                  <RoleIcon role={user.role} />
                  <select
                    value={user.role}
                    onChange={(e) => onChangeRole(user.id, e.target.value as UserRole)}
                    className="input py-1.5"
                  >
                    <option value="Member">Membro</option>
                    <option value="Moderator">Moderador</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/60">
                {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '-'}
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <button
                  onClick={() => onRemoveUser(user.id)}
                  className="text-danger hover:text-danger inline-flex items-center gap-1"
                >
                  <MdDelete className="w-4 h-4" />
                  <span className="hidden sm:inline">Remover</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

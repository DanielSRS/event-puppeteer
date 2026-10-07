import React from 'react';
import { MdPersonOff, MdShield, MdEmail } from 'react-icons/md';

export interface BannedUser {
  id: string;
  name: string;
  email: string;
  bannedAt?: string;
  reason: string;
  reportCount?: number;
}

interface BanListProps {
  bannedUsers: BannedUser[];
  onLiftBan: (userId: string) => void;
}

export function BanList({ bannedUsers, onLiftBan }: BanListProps) {
  if (bannedUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <MdShield className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Nenhum usuário banido</h3>
        <p className="mt-1 text-sm text-gray-500">
          Não há usuários sob shadow ban no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white shadow-sm ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
              Usuário
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Detalhes do Banimento
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Data
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {bannedUsers.map((user) => (
            <tr key={user.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                <div className="flex items-center">
                  <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-red-100">
                    <MdPersonOff className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-gray-500 flex items-center gap-1">
                      <MdEmail className="w-3 h-3" /> {user.email}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-4 text-sm text-gray-500">
                <div className="text-gray-900 font-medium">{user.reason}</div>
                {user.reportCount !== undefined && (
                  <div className="text-red-600 text-xs mt-1">
                    Atingiu limite de denúncias ({user.reportCount} denúncias)
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {user.bannedAt ? new Date(user.bannedAt).toLocaleDateString() : '-'}
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <button
                  onClick={() => onLiftBan(user.id)}
                  className="text-blue-600 hover:text-blue-900"
                >
                  Remover Banimento<span className="sr-only">, {user.name}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

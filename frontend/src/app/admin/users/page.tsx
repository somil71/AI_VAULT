"use client";

import { useMemo, useState } from "react";
import { getKnownUsers } from "@/lib/localData";

const PAGE_SIZE = 5;

export default function AdminUsersPage() {
    const users = getKnownUsers();
    const docs = JSON.parse(typeof window !== "undefined" ? localStorage.getItem("lifevault_docs") || "[]" : "[]");
    const [page, setPage] = useState(1);

    const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
    const pagedUsers = useMemo(() => users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [users, page]);

    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <h2 className="text-xl font-semibold text-white">User List</h2>
                <p className="text-sm text-slate-400">Paginated local users discovered from active sessions.</p>
            </div>

            <div className="glass-card p-5 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-slate-500 border-b border-[#1e3a52]/60">
                            <th className="text-left py-2">Email</th>
                            <th className="text-left py-2">Secure Identity</th>
                            <th className="text-left py-2">Last Seen</th>
                            <th className="text-left py-2">Vault Metadata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedUsers.map((user, idx) => {
                            const relatedDocs = docs.filter((doc: any) => (user.walletAddress ? doc.txHash : false));
                            return (
                                <tr key={`${user.email}-${idx}`} className="border-b border-[#1e3a52]/30">
                                    <td className="py-2">{user.email || "-"}</td>
                                    <td className="py-2 font-mono text-xs">{user.walletAddress || "-"}</td>
                                    <td className="py-2 text-xs text-slate-400">{new Date(user.lastSeenAt).toLocaleString()}</td>
                                    <td className="py-2">
                                        <button className="btn-ghost text-xs" title={JSON.stringify(relatedDocs.slice(0, 3), null, 2)}>
                                            View Metadata ({relatedDocs.length})
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {users.length === 0 ? <p className="text-sm text-slate-500 py-6">No users recorded yet.</p> : null}
                <div className="flex items-center justify-between mt-4">
                    <button className="btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                    <div className="text-xs text-slate-500">Page {page} of {pageCount}</div>
                    <button className="btn-ghost text-xs" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { listVaults, createVault, inviteToVault } from "@/lib/api";
import toast from "react-hot-toast";

export default function TeamVaultManager() {
    const [vaults, setVaults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");

    const fetchVaults = async () => {
        try {
            const data = await listVaults();
            setVaults(data);
        } catch (err) {
            console.error("Failed to load vaults");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVaults();
    }, []);

    const handleCreate = async () => {
        if (!name) return;
        try {
            await createVault(name, desc);
            toast.success("Team Vault created!");
            setShowCreate(false);
            setName("");
            setDesc("");
            fetchVaults();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Team & Shared Vaults</h3>
                <button 
                    onClick={() => setShowCreate(!showCreate)}
                    className="btn-primary py-1.5 px-4 text-xs"
                >
                    {showCreate ? "Cancel" : "+ Create New Vault"}
                </button>
            </div>

            {showCreate && (
                <div className="glass-card p-6 border-cyan-500/30 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-4">
                        <input 
                            placeholder="Vault Name (e.g. Finance Team)"
                            className="bg-[#0a0f1e] border border-slate-700 rounded-lg px-4 py-2 w-full text-white"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <textarea 
                            placeholder="Description..."
                            className="bg-[#0a0f1e] border border-slate-700 rounded-lg px-4 py-2 w-full text-white"
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                        />
                        <button onClick={handleCreate} className="btn-primary w-full py-2">Create Vault</button>
                    </div>
                </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
                {vaults.map((vault) => (
                    <div key={vault._id} className="glass-card p-6 hover:border-cyan-500/30 transition-all cursor-pointer group">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                                    {vault.name}
                                </h4>
                                <p className="text-xs text-slate-500">{vault.description || "No description"}</p>
                            </div>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase">
                                {vault.members?.length} Members
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/50">
                            <button className="text-[10px] text-slate-400 hover:text-white uppercase font-bold">Manage Members</button>
                            <span className="text-slate-700">•</span>
                            <button className="text-[10px] text-slate-400 hover:text-white uppercase font-bold">View Assets</button>
                        </div>
                    </div>
                ))}
                {!loading && vaults.length === 0 && (
                    <div className="sm:col-span-2 p-12 text-center glass-card border-dashed border-slate-800">
                        <p className="text-sm text-slate-500">No shared vaults found. Create one to start collaborating.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

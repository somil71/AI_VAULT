const Vault = require("../models/Vault");
const VaultItem = require("../models/VaultItem");
const { User } = require("../models/User");

/**
 * Vault Service
 * Handles multi-user access control and asset management for sharing.
 */
class VaultService {
    
    /**
     * Creates a new shared vault.
     */
    static async createVault(userId, name, description) {
        const vault = new Vault({
            name,
            description,
            createdBy: userId,
            members: [{ user: userId, role: "owner" }]
        });
        return await vault.save();
    }

    /**
     * Adds a user to a vault with a specific role.
     */
    static async addMember(vaultId, ownerId, targetEmail, role = "viewer") {
        const vault = await Vault.findById(vaultId);
        if (!vault) throw new Error("Vault not found");

        // Verify owner/admin rights
        const requester = vault.members.find(m => m.user.toString() === ownerId.toString());
        if (!requester || !["owner", "admin"].includes(requester.role)) {
            throw new Error("Unauthorized: Only owners or admins can invite members");
        }

        const targetUser = await User.findOne({ email: targetEmail });
        if (!targetUser) throw new Error("User with this email not found");

        if (vault.members.some(m => m.user.toString() === targetUser._id.toString())) {
            throw new Error("User is already a member of this vault");
        }

        vault.members.push({ user: targetUser._id, role });
        return await vault.save();
    }

    /**
     * Verifies if a user has access to a vault.
     */
    static async checkAccess(vaultId, userId, requiredRoles = ["viewer", "admin", "owner"]) {
        const vault = await Vault.findById(vaultId);
        if (!vault) return false;

        const member = vault.members.find(m => m.user.toString() === userId.toString());
        if (!member) return false;

        return requiredRoles.includes(member.role);
    }

    /**
     * Lists all vaults a user has access to.
     */
    static async listUserVaults(userId) {
        return await Vault.find({ "members.user": userId }).populate("createdBy", "email");
    }

    /**
     * Adds an item to a vault.
     */
    static async addItem(vaultId, userId, itemData) {
        const hasAccess = await this.checkAccess(vaultId, userId, ["admin", "owner"]);
        if (!hasAccess) throw new Error("Unauthorized: Items can only be added by admins or owners");

        const item = new VaultItem({
            vaultId,
            createdBy: userId,
            ...itemData
        });
        return await item.save();
    }

    /**
     * Lists items within a specific vault.
     */
    static async listVaultItems(vaultId, userId) {
        const hasAccess = await this.checkAccess(vaultId, userId);
        if (!hasAccess) throw new Error("Unauthorized: Access denied to this vault");

        return await VaultItem.find({ vaultId }).sort({ createdAt: -1 });
    }
}

module.exports = { VaultService };

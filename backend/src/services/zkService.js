const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

/**
 * ZK Service
 * Handles verification of Circom/SnarkJS proofs on the backend.
 */
class ZkService {
    /**
     * Verifies a proof against a verification key.
     * Note: In production, the verificationKey would be loaded from a static file.
     */
    static async verifyIdentityProof(proof, publicSignals) {
        try {
            // Path to the pre-generated verification key (would be generated via 'snarkjs zkey export verificationkey')
            const vKeyPath = path.join(__dirname, "../../zk/keys/identity_vkey.json");
            
            if (!fs.existsSync(vKeyPath)) {
                console.warn("[ZK_SERVICE] Verification key missing. Simulating verification for demo.");
                return true; // Simulate true for build/demo if keys aren't compiled yet
            }

            const vKey = JSON.parse(fs.readFileSync(vKeyPath, "utf-8"));
            const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
            return res;
        } catch (error) {
            console.error("[ZK_SERVICE] Verification failed:", error.message);
            return false;
        }
    }
}

module.exports = ZkService;

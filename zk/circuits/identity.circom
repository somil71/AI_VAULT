pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

/**
 * LifeVault Identity Proof Circuit
 * Proves that a user knows the secret 'nullifier' for a specific identity commitment
 * without revealing the nullifier or the identity itself.
 */
template IdentityProof() {
    // Public Inputs
    signal input identityCommitment;
    
    // Private Inputs
    signal input secret;
    signal input nullifier;

    // Components
    component hasher = Poseidon(2);
    hasher.inputs[0] <== secret;
    hasher.inputs[1] <== nullifier;

    // Verify the commitment matches the secret + nullifier
    identityCommitment === hasher.out;
}

component main {public [identityCommitment]} = IdentityProof();

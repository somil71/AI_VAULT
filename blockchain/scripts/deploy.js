const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function upsertEnv(content, key, value) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
    }
    return `${content.trim()}\n${key}=${value}\n`;
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying with ${deployer.address}`);

    const IdentityNFT = await hre.ethers.getContractFactory("IdentityNFT");
    const identityNFT = await IdentityNFT.deploy();
    await identityNFT.waitForDeployment();

    const VaultRegistry = await hre.ethers.getContractFactory("VaultRegistry");
    const vaultRegistry = await VaultRegistry.deploy();
    await vaultRegistry.waitForDeployment();

    const EmergencyRelease = await hre.ethers.getContractFactory("EmergencyRelease");
    const emergencyRelease = await EmergencyRelease.deploy();
    await emergencyRelease.waitForDeployment();

    const SelectiveVerifier = await hre.ethers.getContractFactory("SelectiveVerifier");
    const selectiveVerifier = await SelectiveVerifier.deploy();
    await selectiveVerifier.waitForDeployment();

    const addresses = {
        IDENTITY_CONTRACT: await identityNFT.getAddress(),
        VAULT_CONTRACT: await vaultRegistry.getAddress(),
        EMERGENCY_CONTRACT: await emergencyRelease.getAddress(),
        VERIFIER_CONTRACT: await selectiveVerifier.getAddress(),
        deployedAt: new Date().toISOString(),
        network: hre.network.name,
    };

    fs.writeFileSync(path.join(__dirname, "deployed-addresses.json"), JSON.stringify(addresses, null, 2));

    const backendEnvPath = path.resolve(__dirname, "../..", "backend", ".env");
    let backendEnv = fs.existsSync(backendEnvPath) ? fs.readFileSync(backendEnvPath, "utf8") : "";
    backendEnv = upsertEnv(backendEnv, "RPC_URL", "http://127.0.0.1:8545");
    backendEnv = upsertEnv(backendEnv, "IDENTITY_CONTRACT", addresses.IDENTITY_CONTRACT);
    backendEnv = upsertEnv(backendEnv, "VAULT_CONTRACT", addresses.VAULT_CONTRACT);
    backendEnv = upsertEnv(backendEnv, "EMERGENCY_CONTRACT", addresses.EMERGENCY_CONTRACT);
    backendEnv = upsertEnv(backendEnv, "VERIFIER_CONTRACT", addresses.VERIFIER_CONTRACT);
    fs.writeFileSync(backendEnvPath, backendEnv);

    const frontendEnvPath = path.resolve(__dirname, "../..", "frontend", ".env.local");
    let frontendEnv = fs.existsSync(frontendEnvPath) ? fs.readFileSync(frontendEnvPath, "utf8") : "";
    frontendEnv = upsertEnv(frontendEnv, "NEXT_PUBLIC_BACKEND_URL", "http://localhost:5000");
    frontendEnv = upsertEnv(frontendEnv, "NEXT_PUBLIC_RPC_URL", "http://127.0.0.1:8545");
    frontendEnv = upsertEnv(frontendEnv, "NEXT_PUBLIC_IDENTITY_CONTRACT", addresses.IDENTITY_CONTRACT);
    frontendEnv = upsertEnv(frontendEnv, "NEXT_PUBLIC_VAULT_CONTRACT", addresses.VAULT_CONTRACT);
    frontendEnv = upsertEnv(frontendEnv, "NEXT_PUBLIC_EMERGENCY_CONTRACT", addresses.EMERGENCY_CONTRACT);
    frontendEnv = upsertEnv(frontendEnv, "NEXT_PUBLIC_VERIFIER_CONTRACT", addresses.VERIFIER_CONTRACT);
    fs.writeFileSync(frontendEnvPath, frontendEnv);

    console.log("Deployed addresses:");
    console.log(addresses);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});


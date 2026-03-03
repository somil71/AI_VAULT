const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("Deploying EmergencyReleasePro...");

    const EmergencyReleasePro = await ethers.getContractFactory("EmergencyReleasePro");
    const erp = await EmergencyReleasePro.deploy();

    await erp.deployed();

    console.log("EmergencyReleasePro deployed to:", erp.address);
    console.log("Deployment Checklist:");
    console.log("1. Verify contract on Etherscan: npx hardhat verify --network <network> " + erp.address);
    console.log("2. Set MIN_GUARDIANS to 2 as per enterprise policy.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

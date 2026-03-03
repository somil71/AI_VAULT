const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EmergencyReleasePro", function () {
    let erp;
    let owner, guardian1, guardian2, guardian3, outsider;

    const VETO_BUFFER = 3600; // 1 hour (minimum)
    const ENCRYPTED_KEY = "enc-vault-key-abc123";

    beforeEach(async function () {
        [owner, guardian1, guardian2, guardian3, outsider] = await ethers.getSigners();

        const ERP = await ethers.getContractFactory("EmergencyReleasePro");
        erp = await ERP.deploy();
        await erp.deployed();
    });

    // ── Setup Tests ──────────────────────────────────────────────────────────

    describe("Vault Setup", function () {
        it("should allow setup with valid params", async function () {
            const tx = await erp.connect(owner).secureVault(
                VETO_BUFFER,
                [guardian1.address, guardian2.address],
                ENCRYPTED_KEY
            );

            await expect(tx)
                .to.emit(erp, "VaultSecured")
                .withArgs(owner.address, VETO_BUFFER, await getTimestamp(tx));
        });

        it("should reject veto buffer below minimum", async function () {
            await expect(
                erp.connect(owner).secureVault(60, [guardian1.address, guardian2.address], ENCRYPTED_KEY)
            ).to.be.revertedWith("ERP: Veto buffer too short");
        });

        it("should reject fewer than 2 guardians", async function () {
            await expect(
                erp.connect(owner).secureVault(VETO_BUFFER, [guardian1.address], ENCRYPTED_KEY)
            ).to.be.revertedWith("ERP: Insufficient guardians");
        });

        it("should reject empty encrypted key", async function () {
            await expect(
                erp.connect(owner).secureVault(VETO_BUFFER, [guardian1.address, guardian2.address], "")
            ).to.be.revertedWith("ERP: Empty key");
        });

        it("should reject owner as guardian (self-guardian bypass)", async function () {
            await expect(
                erp.connect(owner).secureVault(VETO_BUFFER, [owner.address, guardian2.address], ENCRYPTED_KEY)
            ).to.be.revertedWith("ERP: Owner cannot be guardian");
        });
    });

    // ── Trigger Tests ────────────────────────────────────────────────────────

    describe("Release Trigger", function () {
        beforeEach(async function () {
            await erp.connect(owner).secureVault(VETO_BUFFER, [guardian1.address, guardian2.address], ENCRYPTED_KEY);
        });

        it("should allow authorized guardian to trigger release", async function () {
            const tx = await erp.connect(guardian1).triggerRelease(owner.address);
            await expect(tx).to.emit(erp, "ReleaseTriggered");
        });

        it("should reject unauthorized trigger attempt", async function () {
            await expect(
                erp.connect(outsider).triggerRelease(owner.address)
            ).to.be.revertedWith("ERP: Not an authorized guardian");
        });

        it("should reject trigger on non-existent vault", async function () {
            await expect(
                erp.connect(guardian1).triggerRelease(outsider.address)
            ).to.be.revertedWith("ERP: Vault not found");
        });

        it("should reject double trigger on pending vault", async function () {
            await erp.connect(guardian1).triggerRelease(owner.address);
            await expect(
                erp.connect(guardian2).triggerRelease(owner.address)
            ).to.be.revertedWith("ERP: Cannot trigger now");
        });
    });

    // ── Guardian Approval Tests ──────────────────────────────────────────────

    describe("Guardian Approval", function () {
        beforeEach(async function () {
            await erp.connect(owner).secureVault(VETO_BUFFER, [guardian1.address, guardian2.address, guardian3.address], ENCRYPTED_KEY);
            await erp.connect(guardian1).triggerRelease(owner.address);
        });

        it("should allow a second guardian to approve", async function () {
            const tx = await erp.connect(guardian2).approveByGuardian(owner.address);
            await expect(tx).to.emit(erp, "GuardianApproved");
        });

        it("should reject duplicate guardian approval", async function () {
            await expect(
                erp.connect(guardian1).approveByGuardian(owner.address) // guardian1 auto-approved on trigger
            ).to.be.revertedWith("ERP: Already approved");
        });

        it("should reject approval from non-guardian", async function () {
            await expect(
                erp.connect(outsider).approveByGuardian(owner.address)
            ).to.be.revertedWith("ERP: Not an authorized guardian");
        });
    });

    // ── Finalization Tests ───────────────────────────────────────────────────

    describe("Release Finalization", function () {
        beforeEach(async function () {
            await erp.connect(owner).secureVault(VETO_BUFFER, [guardian1.address, guardian2.address], ENCRYPTED_KEY);
            await erp.connect(guardian1).triggerRelease(owner.address);
            await erp.connect(guardian2).approveByGuardian(owner.address);
        });

        it("should block finalization before veto buffer expires", async function () {
            await expect(
                erp.connect(guardian1).finalizeRelease(owner.address)
            ).to.be.revertedWith("ERP: Veto buffer active");
        });

        it("should allow finalization after veto buffer expires with consensus", async function () {
            // Fast-forward time past veto buffer
            await ethers.provider.send("evm_increaseTime", [VETO_BUFFER + 1]);
            await ethers.provider.send("evm_mine", []);

            const tx = await erp.connect(guardian1).finalizeRelease(owner.address);
            await expect(tx).to.emit(erp, "ReleaseFinalized").withArgs(owner.address, ENCRYPTED_KEY);
        });

        it("should block finalization without enough approvals", async function () {
            // Setup fresh vault with 3 guardians, only 1 approves
            await erp.connect(outsider).secureVault(VETO_BUFFER, [guardian1.address, guardian2.address, guardian3.address], "key2");
            await erp.connect(guardian1).triggerRelease(outsider.address);
            // Only guardian1 approved (auto on trigger). Need 2.

            await ethers.provider.send("evm_increaseTime", [VETO_BUFFER + 1]);
            await ethers.provider.send("evm_mine", []);

            await expect(
                erp.connect(guardian1).finalizeRelease(outsider.address)
            ).to.be.revertedWith("ERP: Consensus not reached");
        });

        it("should block double finalization (reentrancy-safe)", async function () {
            await ethers.provider.send("evm_increaseTime", [VETO_BUFFER + 1]);
            await ethers.provider.send("evm_mine", []);

            await erp.connect(guardian1).finalizeRelease(owner.address);

            await expect(
                erp.connect(guardian1).finalizeRelease(owner.address)
            ).to.be.revertedWith("ERP: Not pending");
        });
    });

    // ── Veto (Cancel) Tests ──────────────────────────────────────────────────

    describe("Owner Veto", function () {
        beforeEach(async function () {
            await erp.connect(owner).secureVault(VETO_BUFFER, [guardian1.address, guardian2.address], ENCRYPTED_KEY);
            await erp.connect(guardian1).triggerRelease(owner.address);
        });

        it("should allow owner to cancel a pending release", async function () {
            const tx = await erp.connect(owner).cancelRelease();
            await expect(tx).to.emit(erp, "ReleaseCancelled");
        });

        it("should reset guardian approvals on cancel", async function () {
            await erp.connect(guardian2).approveByGuardian(owner.address);
            await erp.connect(owner).cancelRelease();

            // Re-trigger: guardian2 should be able to approve again (was reset)
            await erp.connect(guardian1).triggerRelease(owner.address);
            await erp.connect(guardian2).approveByGuardian(owner.address);
        });

        it("should reject cancel from non-owner", async function () {
            await expect(
                erp.connect(guardian1).cancelRelease()
            ).to.be.revertedWith("ERP: Not the vault owner");
        });

        it("should reject cancel when no pending release", async function () {
            await erp.connect(owner).cancelRelease(); // cancel once
            await expect(
                erp.connect(owner).cancelRelease() // cancel again
            ).to.be.revertedWith("ERP: No pending release to cancel");
        });
    });

    // ── View Function Tests ──────────────────────────────────────────────────

    describe("View Functions", function () {
        it("should return NONE status for unregistered vault", async function () {
            const [status, timeRemaining, approvalCount] = await erp.getVaultStatus(outsider.address);
            expect(status).to.equal(0); // NONE
            expect(approvalCount).to.equal(0);
        });

        it("should return PENDING status and correct time remaining", async function () {
            await erp.connect(owner).secureVault(VETO_BUFFER, [guardian1.address, guardian2.address], ENCRYPTED_KEY);
            await erp.connect(guardian1).triggerRelease(owner.address);

            const [status, timeRemaining, approvalCount] = await erp.getVaultStatus(owner.address);
            expect(status).to.equal(1); // PENDING
            expect(approvalCount).to.equal(1); // guardian1 auto-approved
            expect(timeRemaining).to.be.gt(0);
        });
    });

    // ── Helper ────────────────────────────────────────────────────────────────

    async function getTimestamp(tx) {
        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt.blockNumber);
        return block.timestamp;
    }
});

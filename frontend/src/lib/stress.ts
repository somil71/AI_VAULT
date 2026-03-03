import { apiClient } from "@/lib/api";
import { withActionLock } from "@/lib/actionLock";

export type StressItemStatus = "pass" | "fail" | "manual";

export type StressChecklistItem = {
    id: string;
    title: string;
    status: StressItemStatus;
    details: string;
};

async function checkRapidClickGuard(): Promise<StressChecklistItem> {
    let duplicateBlocked = false;
    const action = async () => new Promise((resolve) => setTimeout(resolve, 150));
    const first = withActionLock("stress:double", action);
    try {
        await withActionLock("stress:double", action);
    } catch {
        duplicateBlocked = true;
    }
    await first;
    return {
        id: "rapid_click_guard",
        title: "Rapid click duplicate prevention",
        status: duplicateBlocked ? "pass" : "fail",
        details: duplicateBlocked ? "Second call blocked while first action in progress." : "Duplicate call was not blocked.",
    };
}

async function checkBackendFailureSurface(): Promise<StressChecklistItem> {
    try {
        await apiClient.get("/_stress_invalid_endpoint_");
        return {
            id: "backend_failure",
            title: "Backend temporary failure surface",
            status: "fail",
            details: "Unexpected success calling invalid endpoint.",
        };
    } catch {
        return {
            id: "backend_failure",
            title: "Backend temporary failure surface",
            status: "pass",
            details: "Invalid endpoint failure was captured cleanly.",
        };
    }
}

export async function runStressChecklist(): Promise<StressChecklistItem[]> {
    const [rapidClick, backendFailure] = await Promise.all([
        checkRapidClickGuard(),
        checkBackendFailureSurface(),
    ]);

    const manual: StressChecklistItem[] = [
        {
            id: "account_switch_mid_tx",
            title: "Account switch mid-transaction",
            status: "manual",
            details: "Start a tx, switch MetaMask account, confirm UI warns and prevents stale signer writes.",
        },
        {
            id: "chain_switch_mid_flow",
            title: "Chain switch mid-flow",
            status: "manual",
            details: "Switch away from 31337 during pending flow, confirm wrong-network warning and blocked writes.",
        },
        {
            id: "jwt_removal_mid_session",
            title: "JWT removal mid-session",
            status: "manual",
            details: "Use debug control to clear JWT and confirm protected flows are gated again.",
        },
    ];

    return [rapidClick, backendFailure, ...manual];
}


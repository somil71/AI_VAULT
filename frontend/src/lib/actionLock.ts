const actionLocks = new Set<string>();

export function isActionLocked(key: string) {
    return actionLocks.has(key);
}

export async function withActionLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    if (actionLocks.has(key)) {
        throw new Error("Action already in progress");
    }

    actionLocks.add(key);
    try {
        return await task();
    } finally {
        actionLocks.delete(key);
    }
}


import UserShell from "@/components/shell/UserShell";

export default function UserLayout({ children }: { children: React.ReactNode }) {
    return <UserShell>{children}</UserShell>;
}

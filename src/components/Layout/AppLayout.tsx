import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import "./AppLayout.css";

interface AppLayoutProps {
    children: ReactNode;
    activePage: string;
    onNavigate: (page: string) => void;
}

export function AppLayout({ children, activePage, onNavigate }: AppLayoutProps) {
    return (
        <div className="app-layout">
            <Sidebar activePage={activePage} onNavigate={onNavigate} />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
